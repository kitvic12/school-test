import time
from flask import request, jsonify, session
from flask_socketio import emit
from auth import login_teacher

def calculate_grade(score):
    if score is None:
        return None
    if score >= 90: return '5'
    elif score >= 75: return '4'
    elif score >= 50: return '3'
    else: return '2'

def setup_routes(app, socketio, students_sessions, test_manager):
    def check_auto_stop():
        if not test_manager.is_test_active():
            return
        active_students = [
            s for s in students_sessions.values() 
            if s.get('connected', True)
        ]
        if not active_students:
            return
        all_submitted = all(s['score'] is not None for s in active_students)
        if all_submitted:
            test_manager.stop_test()
            emit('test_stopped', {}, broadcast=True, namespace='/student')
            emit('update_students', list(students_sessions.values()), broadcast=True, namespace='/teacher')
            print("✅ Автоматическая остановка: все активные ученики сдали тест")



    @app.route('/api/login', methods=['POST'])
    def login():
        data = request.get_json() or {}
        username = data.get('username')
        password = data.get('password')
        if login_teacher(username, password):
            session['logged_in'] = True
            return jsonify({'message': 'Успешный вход'})
        return jsonify({'error': 'Неверный логин или пароль'}), 401

    @app.route('/api/logout', methods=['POST'])
    def logout():
        session.clear()
        return jsonify({'message': 'Выход'})

    @app.route('/api/student/register', methods=['POST'])
    def student_register():
        data = request.get_json() or {}
        name = data.get('student_name')
        if not name:
            return jsonify({'error': 'Фамилия обязательна'}), 400
        
        ip = request.remote_addr
        sid = f"{ip}_{int(time.time() * 1000)}"
        
        students_sessions[sid] = {
            'name': name,
            'ip': ip,
            'score': None,
            'grade': None,
            'timestamp': None,
            'connected': True
        }
        emit('update_students', list(students_sessions.values()), broadcast=True, namespace='/teacher')
        return jsonify({
            'message': 'Ученик зарегистрирован',
            'active': test_manager.is_test_active(),
            'variant': test_manager.get_current_variant() if test_manager.is_test_active() else None
        })

    @app.route('/api/student/submit-result', methods=['POST'])
    def student_submit():
        if not test_manager.is_test_active():
            return jsonify({'error': 'Тест завершён'}), 400
        
        data = request.get_json() or {}
        score = data.get('score')
        student_name = data.get('student_name')  
        
        if not student_name or score is None:
            return jsonify({'error': 'Фамилия и баллы обязательны'}), 400
        

        found = False
        for sid, info in students_sessions.items():
            if info['name'] == student_name:
                grade = calculate_grade(score)
                from datetime import datetime
                students_sessions[sid].update({
                    'score': score,
                    'grade': grade,
                    'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                })
                found = True
                break
        
        if not found:
            return jsonify({'error': 'Ученик не найден'}), 400
        
        emit('update_students', list(students_sessions.values()), broadcast=True, namespace='/teacher')
        check_auto_stop()
        return jsonify({'grade': grade})

        


    @app.route('/api/start-test', methods=['POST'])
    def start_test():
        if 'logged_in' not in session:
            return jsonify({'error': 'Не авторизован'}), 401
        
        data = request.get_json() or {}
        variant = data.get('variant')
        if variant not in ['powers', 'squares']:
            return jsonify({'error': 'Неверный вариант теста'}), 400
        
        if test_manager.start_test(variant):
            emit('test_started', {'variant': variant}, broadcast=True, namespace='/student')
            return jsonify({'message': f'Тест запущен ({variant})'})
        return jsonify({'error': 'Нельзя запустить тест. Завершите предыдущий.'}), 400

    @app.route('/api/stop-test', methods=['POST'])
    def stop_test():
        if 'logged_in' not in session:
            return jsonify({'error': 'Не авторизован'}), 401
        
        if test_manager.stop_test():
            emit('test_stopped', {}, broadcast=True, namespace='/student')
            return jsonify({'message': 'Тест остановлен'})
        return jsonify({'error': 'Тест не запущен'}), 400

    @app.route('/api/finalize-test', methods=['POST'])
    def finalize_test():
        if 'logged_in' not in session:
            return jsonify({'error': 'Не авторизован'}), 401
        
        test_manager.finalize_test()
        students_sessions.clear()
        emit('update_students', [], broadcast=True, namespace='/teacher')
        return jsonify({'message': 'Тест завершён. Все данные удалены.'})

    from flask_socketio import disconnect

    @app.route('/api/kick', methods=['POST'])
    def kick_student():
        if 'logged_in' not in session:
            return jsonify({'error': 'Не авторизован'}), 401
        
        data = request.get_json() or {}
        target_ip = data.get('ip')
        if not target_ip:
            return jsonify({'error': 'IP не указан'}), 400
        
        sids_to_remove = []
        for sid, info in students_sessions.items():
            if info['ip'] == target_ip:
                sids_to_remove.append(sid)
        
        for sid in sids_to_remove:
            try:
                disconnect(sid=sid, namespace='/student')
            except:
                pass

            del students_sessions[sid]
            try:
                emit('kicked', {'message': 'Выгнан!'}, room=sid, namespace='/student')
            except:
                pass
        
        emit('update_students', list(students_sessions.values()), broadcast=True, namespace='/teacher')
        return jsonify({'message': 'Ученик выгнан'})

    @app.route('/api/results')
    def get_results():
        return jsonify({'results': list(students_sessions.values())})

    @app.route('/api/test-status')
    def get_test_status():
        all_submitted = all(
            s['score'] is not None for s in students_sessions.values()
        ) if students_sessions else False
        
        return jsonify({
            'active': test_manager.is_test_active(),
            'variant': test_manager.get_current_variant(),
            'finalized': test_manager.is_finalized(),
            'allSubmitted': all_submitted
        })


    @socketio.on('connect', namespace='/student')
    def handle_student_connect():
        pass

    @socketio.on('connect', namespace='/teacher')
    def handle_teacher_connect():
        emit('update_students', list(students_sessions.values()))

    @socketio.on('disconnect')
    def handle_disconnect():
        sid = request.sid
        if sid in students_sessions:
            students_sessions[sid]['connected'] = False  
            emit('update_students', list(students_sessions.values()), broadcast=True, namespace='/teacher')