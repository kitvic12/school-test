from flask import request, jsonify, session
from flask_socketio import emit
from datetime import datetime
from auth import login_teacher
from question import generate_question_advanced, check_answer
from writer import save_students, load_students, load_settings, delete_student, clear_for_new_test


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
    # Перезагружаем данные из файла чтобы получить актуальный список студентов
    app.students_data = load_students()
    result = []
    for record in app.students_data.get('students', {}).values():
        student = record.copy()
        student['computer_number'] = student.get('computer_number', student.get('pc'))
        student['name'] = student.get('name')
        result.append(student)
    return result


def is_teacher_authorized(app):
    """Проверяет авторизован ли учитель на основе IP адреса"""
    client_ip = request.remote_addr
    primary_ip = '127.0.0.1'
    secondary_ip = load_settings(what="SecondaryTeacherIP")
    
    # Основной адрес или вторичный (если установлен)
    if client_ip == primary_ip:
        return True
    if secondary_ip and client_ip == secondary_ip:
        return True
    return False


def setup_routes(app, socketio, students_sessions, test_manager):

    @app.route('/api/server-session', methods=['GET'])
    def get_server_session():
        """Возвращает уникальный ID сессии сервера для проверки перезагрузки"""
        return jsonify({'server_session_id': app.server_session_id})

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
        if is_teacher_authorized(app):
            emit('update_students', get_persisted_student_list(app), namespace='/teacher', broadcast=True)

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
        

        asked_questions = record.get('asked_questions', {'sqrt': [], 'powers': []})
        if isinstance(asked_questions, list):  
            asked_questions = {'sqrt': [], 'powers': []}
        
        record.update({
            'name': name,
            'pc': comp_num,
            'computer_number': comp_num,
            'type': None,
            'asked_questions': asked_questions,
            'score': record.get('score', None),
            'grade': record.get('grade', None),
            'timestamp': record.get('timestamp'),
            'ip': request.remote_addr,
            'connected': True,
            'correct_answers': 0  # Счетчик правильных ответов на бэке
        })
        students_data[student_key] = record
        save_students(app.students_data)

        students_sessions[sid] = student_key

        emit('register_success', {
            'active': test_manager.is_test_active(),
            'variant': test_manager.get_current_variant() if test_manager.is_test_active() else None,
            'student_key': student_key
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

        student_key = students_sessions[sid]
        student_record = app.students_data['students'].get(student_key)
        if student_record is None:
            emit('submit_error', {'error': 'Запись ученика не найдена'}, namespace='/student')
            return

        # Используем накопленные баллы со скинутых ответов, не берем от клиента
        score = min(100, student_record.get('current_score', 0))
        
        grade = calculate_grade(score)
        student_record.update({
            'score': score,
            'grade': grade,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'asked_questions': {'sqrt': [], 'powers': []},
            'current_score': 0,  # Очищаем текущий счетчик
            'current_question_attempts': 0
        })
        save_students(app.students_data)

        emit('submit_success', {'grade': grade, 'score': score}, namespace='/student')
        emit('update_students', get_persisted_student_list(app), namespace='/teacher', broadcast=True)

        active_students = [s for s in app.students_data.get('students', {}).values() if s.get('connected', False)]
        if active_students and all(s.get('score') is not None for s in active_students):
            emit('all_students_submitted', {}, namespace='/teacher', broadcast=True)

    @socketio.on('student_logout', namespace='/student')
    def handle_student_logout():
        sid = request.sid
        student_key = students_sessions.pop(sid, None)
        if student_key:
            delete_student(request.remote_addr)
            print(f"Student with SID {sid} disconnected and removed. IP: {request.remote_addr}  ")
            app.students_data = load_students()
            emit('logout_success', {}, namespace='/student')
            emit('update_students', get_persisted_student_list(app), namespace='/teacher', broadcast=True)


    @socketio.on('disconnect', namespace='/student')
    def handle_student_disconnect():
        sid = request.sid
        students_sessions.pop(sid, None)


    @socketio.on('start_test', namespace='/teacher')
    def handle_start_test(data):
        if not is_teacher_authorized(app):
            return
        variant = data.get('variant')
        if test_manager.start_test(variant):
            # Очищаем результаты студентов перед началом нового теста
            for student_record in app.students_data.get('students', {}).values():
                student_record['score'] = None
                student_record['grade'] = None
                student_record['timestamp'] = None
                student_record['asked_questions'] = {'sqrt': [], 'powers': []}
                student_record['correct_answers'] = 0  # Обнуляем счетчик
            
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
        if not is_teacher_authorized(app):
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
        if not is_teacher_authorized(app):
            return
        test_manager.finalize_test()
        # Очищаем результаты всех студентов перед новым тестом
        for student_record in app.students_data.get('students', {}).values():
            student_record['score'] = None
            student_record['grade'] = None
            student_record['timestamp'] = None
            student_record['asked_questions'] = {'sqrt': [], 'powers': []}
            student_record['correct_answers'] = 0  # Обнуляем счетчик
        
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
        if not is_teacher_authorized(app):
            return
        test_manager.finalize_test()
        app.students_data['test_state'] = {
            'active': False,
            'variant': None,
            'finalized': True
        }

        app.students_data['students'] = {}
        students_sessions.clear()

        save_students(app.students_data)
        clear_for_new_test()
        emit('test_finalized', {}, namespace='/student', broadcast=True)
        emit('update_students', get_persisted_student_list(app), namespace='/teacher', broadcast=True)


    @socketio.on('kick_student', namespace='/teacher')
    def handle_kick_student(data):
        if not is_teacher_authorized(app):
            return
        target_ip = data.get('ip')

        students_data = app.students_data['students']
        student_key_to_kick = None
        sid_to_notify = None
        
        for key, student_record in students_data.items():
            if student_record.get('ip') == target_ip:
                student_key_to_kick = key
                break
        

        if student_key_to_kick:
            for sid, sk in list(students_sessions.items()):
                if sk == student_key_to_kick:
                    sid_to_notify = sid
                    students_sessions.pop(sid, None)
                    break
            
            delete_student(target_ip)
            app.students_data = load_students()
            

            if sid_to_notify:
                try:
                    emit('kicked_to_login', {}, room=sid_to_notify, namespace='/student')
                except Exception:
                    pass
        
        emit('update_students', get_persisted_student_list(app), namespace='/teacher', broadcast=True)


    @socketio.on('new_quest', namespace='/student')
    def handle_new_quest(data):
        if not test_manager.is_test_active():
            emit('quest_error', {'error': 'Тест не активен'}, namespace='/student')
            return
        
        sid = request.sid
        student_key = students_sessions.get(sid)
        if not student_key:
            emit('quest_error', {'error': 'Студент не зарегистрирован'}, namespace='/student')
            return
        student_record = app.students_data['students'].get(student_key, {})
        asked_questions = student_record.get('asked_questions', {'sqrt': [], 'powers': []})
        
        mode = normalize_variant(data.get('mode'))
        
        # Инициализируем счетчик попыток и текущий вопрос
        if 'current_question_attempts' not in student_record:
            student_record['current_question_attempts'] = 0
        student_record['current_question_attempts'] = 0  # Сбрасываем для нового вопроса
        
        try:
            question, updated_questions_dict, returned_type = generate_question_advanced(mode, asked_questions)
            student_record['asked_questions'] = updated_questions_dict
            student_record['current_question'] = question  # Сохраняем текущий вопрос
            student_record['current_question_type'] = returned_type
            save_students(app.students_data)
            
            emit('new_quest', {
                'question': question,
                'returned_type': returned_type,
                'updated_questions': updated_questions_dict[mode],
                'current_score': student_record.get('current_score', 0)  # Отправляем текущие баллы
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
        
        sid = request.sid
        student_key = students_sessions.get(sid)
        if not student_key or student_key not in app.students_data['students']:
            emit('check_error', {'error': 'Студент не найден'}, namespace='/student')
            return
        
        student_record = app.students_data['students'][student_key]
        
        try:
            result = check_answer(mode, question, question_type, student_answer)
            
            # Увеличиваем счетчик попыток
            student_record['current_question_attempts'] = student_record.get('current_question_attempts', 0) + 1
            
            # Если ответ правильный - вычисляем баллы на бэке
            if result:
                attempts = student_record.get('current_question_attempts', 1)
                # 10 баллов за первую попытку, 5 за остальные
                points = 10 if attempts == 1 else 5
                student_record['current_score'] = student_record.get('current_score', 0) + points
            
            save_students(app.students_data)
            
            # Отправляем результат и текущие баллы
            emit('check_result', {
                'result': result,
                'points_earned': (10 if student_record.get('current_question_attempts', 1) == 1 else 5) if result else 0,
                'current_score': student_record.get('current_score', 0)
            }, namespace='/student')
        except Exception as exc:
            emit('check_error', {'error': str(exc)}, namespace='/student')


    @socketio.on('updateQuestionsCount', namespace='/teacher')
    def handle_update_questions_count(data):
        if not is_teacher_authorized(app):
            return
        emit('updateQuestionsCount', {'count': data.get('count')}, namespace='/student', broadcast=True)


    @socketio.on('reload_students', namespace='/teacher')
    def handle_reload_students():
        if not is_teacher_authorized(app):
            return
        app.students_data = load_students()
        emit('update_students', get_persisted_student_list(app), namespace='/teacher', broadcast=True)

    @socketio.on('update_student_settings', namespace='/teacher')
    def handle_update_student_settings(data):
        settings = load_settings()
        student_settings = {
            'TotalQuestions': data.get('TotalQuestions') or settings.get('TotalQuestions', 10),
            'TimePerQuestion': data.get('TimePerQuestion') or settings.get('TimePerQuestion', 10)
        }
        emit('update_student_settings', student_settings, namespace='/student', broadcast=True)