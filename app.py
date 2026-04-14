import os
import sys
import socket
import secrets
from flask import Flask, send_from_directory, request, jsonify, session
from flask_socketio import SocketIO

from writer import load_students, clear_for_new_test, load_settings, update_settings, is_active
from test_manager import TestManager
from routes import setup_routes



def reload_server():
    os.execv(sys.executable, ['python'] + sys.argv)


def get_local_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except:
        return "127.0.0.1"

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
app.server_session_id = secrets.token_hex(16)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=False,
    SESSION_COOKIE_NAME='school_test_session',
    PERMANENT_SESSION_LIFETIME=86400  
)


from flask_logger import FlaskLogger
flask_logger = FlaskLogger(app)

socketio = SocketIO(app, cors_allowed_origins="*")

students_sessions = {}
test_manager = TestManager()

os.makedirs('static/student', exist_ok=True)
os.makedirs('static/teacher', exist_ok=True)

app.students_data = load_students()
if 'students' not in app.students_data:
    app.students_data['students'] = {}
if 'test_state' not in app.students_data:
    app.students_data['test_state'] = {
        'active': False,
        'variant': None,
        'finalized': True
    }


@app.after_request
def log_request_info(response):
    flask_logger.log_request(response)
    return response

@app.route('/')
def student():
    return send_from_directory('static/student', 'index.html')

@app.route('/teacher', methods=['GET'])
def teacher():
    client_ip = request.remote_addr
    if client_ip != load_settings(what="TeacherIP"):
        print(f"⚠️ Попытка доступа к учительской панели с IP: {client_ip}", load_settings(what="TeacherIP"))
        return "❌ Доступ запрещён", 403
    return send_from_directory('static/teacher', 'index.html')

@app.route('/<path:path>')
def student_static(path):
    return send_from_directory('static/student', path)


@app.route('/api/settings', methods=['GET'])
def api_settings():
    settings = load_settings()
    if settings is None:
        return jsonify({"error": "Failed to load settings"}), 500
    return jsonify({
        "TeacherIP": settings.get("TeacherIP"),
        "Port": settings.get("Port"),
        "TimePerQuestion": settings.get("TimePerQuestion"),
        "TotalQuestions": settings.get("TotalQuestions"),
        "Graduations5": settings.get("Graduations5"),
        "Graduations4": settings.get("Graduations4"),
        "Graduations3": settings.get("Graduations3")
    })

@app.route('/api/get_student_settings', methods=['GET'])
def get_student_settings():
    """Возвращает настройки для страницы студента"""
    settings = load_settings()
    if settings is None:
        return jsonify({
            "TotalQuestions": 10,
            "TimePerQuestion": 10
        })
    return jsonify({
        "TotalQuestions": settings.get("TotalQuestions", 10),
        "TimePerQuestion": settings.get("TimePerQuestion", 10)
    })

@app.route('/api/test-status', methods=['GET'])
def get_test_status():
    """Возвращает текущий статус теста"""
    return jsonify({
        'active': test_manager.is_test_active(),
        'variant': test_manager.current_variant,
        'finalized': test_manager.is_finalized()
    })

@app.route('/api/settings', methods=['POST'])
def save_settings():
    if not session.get('logged_in'):
        return jsonify({'error': 'Не авторизован'}), 401
    if is_active():
        return jsonify({'error': 'Нельзя менять настройки во время активного теста'}), 400
    

    old_settings = load_settings()
    old_port = old_settings.get('Port', 5000) if old_settings else 5000
    
    data = request.get_json()
    new_port = data.get("Port", old_port)
    
    update_settings(data)

    port_changed = (old_port != new_port)
    
    return jsonify({
        'message': 'Настройки сохранены',
        'port_changed': port_changed,
        'old_port': old_port,
        'new_port': new_port
    })

@app.route('/ST.ico')
def favicon():
    return send_from_directory('.', 'ST.ico')



setup_routes(app, socketio, students_sessions, test_manager)




if __name__ == '__main__':
    clear_for_new_test()
    local_ip = get_local_ip()
    port = load_settings(what="Port")
    print("\n" + "="*50)
    print("\x1b[32m🚀 ЛОКАЛЬНЫЙ ТЕСТ ЗАПУЩЕН\x1b[0m")
    print(f"🔹 IP: \x1b[33m{local_ip}\x1b[0m")
    print(f"🧑‍🎓 Ученики: http://{local_ip}:{port}")
    print(f"👨‍🏫 Учитель: http://127.0.0.1:{port}/teacher")
    print("="*50 + "\n")
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
