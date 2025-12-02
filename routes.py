from flask import request, jsonify, session
from flask_socketio import emit
from datetime import datetime
from auth import login_teacher

def calculate_grade(score):
    if score is None:
        return None
    if score >= 90: return '5'
    elif score >= 75: return '4'
    elif score >= 50: return '3'
    else: return '2'

def setup_routes(app, socketio, students_sessions, test_manager):
    
    @app.route('/api/check-login')
    def check_login():
        if session.get('logged_in'):
            return jsonify({'loggedIn': True})
        return jsonify({'loggedIn': False})

    @app.route('/api/login', methods=['POST'])
    def login():
        data = request.get_json() or {}
        username = data.get('username')
        password = data.get('password')
        if login_teacher(username, password):
            session.permanent = True
            session['logged_in'] = True
            return jsonify({'message': 'Успешный вход'})
        return jsonify({'error': 'Неверный логин или пароль'}), 401

    @app.route('/api/logout', methods=['POST'])
    def logout():
        session.clear()
        return jsonify({'message': 'Выход'})

    @socketio.on('get_students', namespace='/teacher')
    def handle_get_students():
        if session.get('logged_in'):
            emit('update_students', list(students_sessions.values()), namespace='/teacher')

    @socketio.on('student_register', namespace='/student')
    def handle_student_register(data):
        name = data.get('student_name')
        comp_num = data.get('computer_number')
        if not name or not comp_num:
            emit('register_error', {'error': 'Фамилия и номер ПК обязательны'}, namespace='/student')
            return
        
        sid = request.sid
        students_sessions[sid] = {
            'computer_number': comp_num,
            'name': name,
            'ip': request.remote_addr,
            'score': None,
            'grade': None,
            'timestamp': None,
            'connected': True
        }
        emit('register_success', {
            'active': test_manager.is_test_active(),
            'variant': test_manager.get_current_variant() if test_manager.is_test_active() else None
        }, namespace='/student')
        emit('update_students', list(students_sessions.values()), namespace='/teacher', broadcast=True)

    @socketio.on('student_submit', namespace='/student')
    def handle_student_submit(data):
        if not test_manager.is_test_active():
            emit('submit_error', {'error': 'Тест завершён'}, namespace='/student')
            return
        sid = request.sid
        if sid not in students_sessions:
            emit('submit_error', {'error': 'Не зарегистрирован'}, namespace='/student')
            return
        score = data.get('score')
        grade = calculate_grade(score)
        students_sessions[sid].update({
            'score': score,
            'grade': grade,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        emit('submit_success', {'grade': grade}, namespace='/student')
        emit('update_students', list(students_sessions.values()), namespace='/teacher', broadcast=True)
        active_students = [s for s in students_sessions.values() if s.get('connected', True)]
        all_submitted = all(s['score'] is not None for s in active_students)
        if all_submitted:
            emit('all_students_submitted', {
                'message': 'Все ученики сдали тест'
            }, namespace='/teacher', broadcast=True)

    @socketio.on('start_test', namespace='/teacher')
    def handle_start_test(data):
        if 'logged_in' not in session:
            return
        variant = data.get('variant')
        if test_manager.start_test(variant):
            emit('test_started', {'variant': variant}, namespace='/student', broadcast=True)
            emit('test_started', {'variant': variant}, namespace='/teacher', broadcast=True)

    @socketio.on('stop_test', namespace='/teacher')
    def handle_stop_test():
        if 'logged_in' not in session:
            return
        if test_manager.stop_test():
            emit('test_stopped', {}, namespace='/student', broadcast=True)
            emit('test_stopped', {}, namespace='/teacher', broadcast=True)
            emit('update_students', list(students_sessions.values()), namespace='/teacher', broadcast=True)

    @socketio.on('finalize_test', namespace='/teacher')
    def handle_finalize_test():
        if 'logged_in' not in session:
            return
        test_manager.finalize_test()
        students_sessions.clear()
        emit('test_finalized', {}, namespace='/student', broadcast=True)
        emit('update_students', [], namespace='/teacher', broadcast=True)

    @socketio.on('kick_student', namespace='/teacher')
    def handle_kick_student(data):
        if 'logged_in' not in session:
            return
        target_ip = data.get('ip')
        for sid, info in list(students_sessions.items()):
            if info['ip'] == target_ip:
                del students_sessions[sid]
                try:
                    emit('kicked_to_login', {}, room=sid, namespace='/student')
                except:
                    pass
                break
        emit('update_students', list(students_sessions.values()), namespace='/teacher', broadcast=True)