from flask import request, jsonify, session
from flask_socketio import emit
from datetime import datetime
from auth import login_teacher
from question import generate_question_advanced, check_answer
from writer import save_students, load_settings


def calculate_grade(score):
    grade = load_settings(what="Graduations")

    if score is None:
        return None
    if score >= grade[0]:
        return '5'
    elif score >= grade[1]:
        return '4'
    elif score >= grade[2]:
        return '3'
    else:
        return '2'


def normalize_variant(variant):
    if variant == 'squares':
        return 'sqrt'
    return variant


def make_student_key(name, pc):
    return f"{name.strip().lower()}|{pc.strip().lower()}"


def get_persisted_student_list(app):
    result = []
    for record in app.students_data.get('students', {}).values():
        student = record.copy()
        student['computer_number'] = student.get('computer_number', student.get('pc'))
        student['name'] = student.get('name')
        result.append(student)
    return result


def setup_routes(app, socketio, students_sessions, test_manager):

    @app.route('/api/check-login')
    def check_login():
        return jsonify({'loggedIn': bool(session.get('logged_in'))})

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
            emit('update_students', get_persisted_student_list(app), namespace='/teacher')

    @socketio.on('student_register', namespace='/student')
    def handle_student_register(data):
        name = data.get('student_name')
        comp_num = data.get('computer_number')
        if not name or not comp_num:
            emit('register_error', {'error': 'Фамилия и номер ПК обязательны'}, namespace='/student')
            return

        sid = request.sid
        student_key = make_student_key(name, comp_num)
        students_data = app.students_data.setdefault('students', {})
        record = students_data.get(student_key, {})
        record.update({
            'name': name,
            'pc': comp_num,
            'computer_number': comp_num,
            'type': None,
            'askedquestions': record.get('askedquestions', []),
            'score': record.get('score', None),
            'grade': record.get('grade', None),
            'timestamp': record.get('timestamp'),
            'ip': request.remote_addr,
            'connected': True
        })
        students_data[student_key] = record
        save_students(app.students_data)

        students_sessions[sid] = student_key

        emit('register_success', {
            'active': test_manager.is_test_active(),
            'variant': test_manager.get_current_variant() if test_manager.is_test_active() else None
        }, namespace='/student')
        emit('update_students', get_persisted_student_list(app), namespace='/teacher', broadcast=True)

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
        student_key = students_sessions[sid]
        student_record = app.students_data['students'].get(student_key)
        if student_record is None:
            emit('submit_error', {'error': 'Запись ученика не найдена'}, namespace='/student')
            return

        grade = calculate_grade(score)
        student_record.update({
            'score': score,
            'grade': grade,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        save_students(app.students_data)

        emit('submit_success', {'grade': grade}, namespace='/student')
        emit('update_students', get_persisted_student_list(app), namespace='/teacher', broadcast=True)

        active_students = [s for s in app.students_data.get('students', {}).values() if s.get('connected', False)]
        if active_students and all(s.get('score') is not None for s in active_students):
            emit('all_students_submitted', {}, namespace='/teacher', broadcast=True)

    @socketio.on('student_logout', namespace='/student')
    def handle_student_logout():
        sid = request.sid
        student_key = students_sessions.pop(sid, None)
        if student_key and student_key in app.students_data.get('students', {}):
            student_record = app.students_data['students'][student_key]
            student_record['connected'] = False
            save_students(app.students_data)
            emit('update_students', get_persisted_student_list(app), namespace='/teacher', broadcast=True)

    @socketio.on('disconnect', namespace='/student')
    def handle_student_disconnect():
        sid = request.sid
        student_key = students_sessions.pop(sid, None)
        if student_key and student_key in app.students_data.get('students', {}):
            student_record = app.students_data['students'][student_key]
            student_record['connected'] = False
            save_students(app.students_data)
            emit('update_students', get_persisted_student_list(app), namespace='/teacher', broadcast=True)

    @socketio.on('start_test', namespace='/teacher')
    def handle_start_test(data):
        if not session.get('logged_in'):
            return
        variant = data.get('variant')
        if test_manager.start_test(variant):
            app.students_data['test_state'] = {
                'active': True,
                'variant': variant,
                'finalized': False
            }
            save_students(app.students_data)
            emit('test_started', {'variant': variant}, namespace='/student', broadcast=True)
            emit('test_started', {'variant': variant}, namespace='/teacher', broadcast=True)

    @socketio.on('stop_test', namespace='/teacher')
    def handle_stop_test():
        if not session.get('logged_in'):
            return
        if test_manager.stop_test():
            app.students_data['test_state'].update({
                'active': False,
                'finalized': False
            })
            save_students(app.students_data)
            emit('test_stopped', {}, namespace='/student', broadcast=True)
            emit('test_stopped', {}, namespace='/teacher', broadcast=True)
            emit('update_students', get_persisted_student_list(app), namespace='/teacher', broadcast=True)

    @socketio.on('new_test', namespace='/teacher')
    def handle_open_new_test():
        if not session.get('logged_in'):
            return
        test_manager.finalize_test()
        app.students_data['test_state'] = {
            'active': False,
            'variant': None,
            'finalized': True
        }
        save_students(app.students_data)
        emit('new_test', {}, namespace='/student', broadcast=True)
        emit('update_students', get_persisted_student_list(app), namespace='/teacher', broadcast=True)

    @socketio.on('finalize_test', namespace='/teacher')
    def handle_finalize_test():
        if not session.get('logged_in'):
            return
        test_manager.finalize_test()
        app.students_data['test_state'] = {
            'active': False,
            'variant': None,
            'finalized': True
        }
        save_students(app.students_data)
        emit('test_finalized', {}, namespace='/student', broadcast=True)
        emit('update_students', get_persisted_student_list(app), namespace='/teacher', broadcast=True)

    @socketio.on('kick_student', namespace='/teacher')
    def handle_kick_student(data):
        if not session.get('logged_in'):
            return
        target_ip = data.get('ip')
        for sid, student_key in list(students_sessions.items()):
            student_record = app.students_data['students'].get(student_key)
            if student_record and student_record.get('ip') == target_ip:
                students_sessions.pop(sid, None)
                student_record['connected'] = False
                save_students(app.students_data)
                try:
                    emit('kicked_to_login', {}, room=sid, namespace='/student')
                except Exception:
                    pass
                break
        emit('update_students', get_persisted_student_list(app), namespace='/teacher', broadcast=True)

    @socketio.on('new_quest', namespace='/student')
    def handle_new_quest(data):
        if not test_manager.is_test_active():
            emit('quest_error', {'error': 'Тест не активен'}, namespace='/student')
            return
        mode = normalize_variant(data.get('mode'))
        asked_questions = data.get('asked_questions', [])
        try:
            question, updated_questions, returned_type = generate_question_advanced(mode, asked_questions)
            emit('new_quest', {
                'question': question,
                'returned_type': returned_type,
                'updated_questions': updated_questions
            }, namespace='/student')
        except Exception as exc:
            emit('quest_error', {'error': str(exc)}, namespace='/student')

    @socketio.on('check_quest', namespace='/student')
    def handle_check_quest(data):
        if not test_manager.is_test_active():
            emit('check_error', {'error': 'Тест не активен'}, namespace='/student')
            return
        mode = normalize_variant(data.get('mode'))
        question = data.get('question')
        question_type = data.get('question_type')
        student_answer = data.get('student_answer')
        try:
            result = check_answer(mode, question, question_type, student_answer)
            emit('check_result', {'result': result}, namespace='/student')
        except Exception as exc:
            emit('check_error', {'error': str(exc)}, namespace='/student')


