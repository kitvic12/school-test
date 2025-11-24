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

def count_correct(score):
    if score is None:
        return 0
    return min(10, score // 10)

def check_auto_stop(students_sessions, test_manager, emit_func):
    if not test_manager.is_test_active():
        return
    # Проверяем всех учеников, кто сдал
    active_students = [s for s in students_sessions.values() if s.get('connected', True)]
    if not active_students:
        return
    all_submitted = all(s['score'] is not None for s in active_students)
    if all_submitted:
        test_manager.stop_test()
        emit_func('test_stopped', {
            'reason': 'auto',
            'message': 'Тест автоматически остановлен: все ученики сдали'
        }, namespace='/teacher', broadcast=True)
        emit_func('test_stopped', {}, namespace='/student', broadcast=True)
        # Отправляем ВСЕХ учеников, даже тех, кто уже сдал
        emit_func('update_students', list(students_sessions.values()), namespace='/teacher', broadcast=True)
        print("✅ Автоостановка: все ученики сдали, но данные остались")

def setup_routes(app, socketio, students_sessions, test_manager):
    
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

    @app.route('/api/check-login')
    def check_login():
        if session.get('logged_in'):
            return jsonify({'loggedIn': True})
        return jsonify({'loggedIn': False})

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
            'variant': test_manager.get_current_variant()
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
        from datetime import datetime
        students_sessions[sid].update({
            'score': score,
            'grade': calculate_grade(score),
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        emit('submit_success', {'grade': students_sessions[sid]['grade']}, namespace='/student')
        emit('update_students', list(students_sessions.values()), namespace='/teacher', broadcast=True)
        check_auto_stop(students_sessions, test_manager, emit)

    @socketio.on('student_logout', namespace='/student')
    def handle_student_logout():
        sid = request.sid
        if sid in students_sessions:
            del students_sessions[sid]
        emit('update_students', list(students_sessions.values()), namespace='/teacher', broadcast=True)

    @socketio.on('start_test', namespace='/teacher')
    def handle_start_test(data):
        if 'logged_in' not in session:
            return
        variant = data.get('variant')
        if variant not in ['powers', 'squares']:
            return
        if test_manager.start_test(variant):
            emit('test_started', {'variant': variant}, namespace='/student', broadcast=True)
            emit('test_started', {'variant': variant}, namespace='/teacher', broadcast=True)

    @socketio.on('stop_test', namespace='/teacher')
    def handle_stop_test():
        if 'logged_in' not in session:
            return
        if test_manager.stop_test():
            # НЕ очищаем students_sessions — ученики остаются в таблице
            emit('test_stopped', {}, namespace='/student', broadcast=True)
            emit('test_stopped', {}, namespace='/teacher', broadcast=True)
            # Обновляем таблицу
            emit('update_students', list(students_sessions.values()), namespace='/teacher', broadcast=True)

    @socketio.on('finalize_test', namespace='/teacher')
    def handle_finalize_test():
        if 'logged_in' not in session:
            return
        test_manager.finalize_test()
        students_sessions.clear()  # ← Очищаем ТОЛЬКО при завершении
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

    @socketio.on('teacher_login', namespace='/teacher')
    def handle_teacher_login(data):
        username = data.get('username')
        password = data.get('password')
        if login_teacher(username, password):
            session['logged_in'] = True
            emit('login_success', namespace='/teacher')
        else:
            emit('login_error', {'error': 'Неверный логин или пароль'}, namespace='/teacher')

    @socketio.on('teacher_logout', namespace='/teacher')
    def handle_teacher_logout():
        session.clear()
        emit('logout_success', namespace='/teacher')

    @socketio.on('connect', namespace='/teacher')
    def handle_teacher_connect():
        if session.get('logged_in'):
            emit('test_status', {
                'active': test_manager.is_test_active(),
                'variant': test_manager.get_current_variant(),
                'finalized': test_manager.is_finalized()
            }, namespace='/teacher')
            emit('update_students', list(students_sessions.values()), namespace='/teacher')

    @socketio.on('disconnect', namespace='/student')
    def handle_student_disconnect():
        sid = request.sid
        if sid in students_sessions:
            students_sessions[sid]['connected'] = False
            emit('update_students', list(students_sessions.values()), namespace='/teacher', broadcast=True)