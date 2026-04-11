import os
import socket
from flask import Flask, send_from_directory, request, jsonify, session
from flask_socketio import SocketIO

from writer import load_students, save_students
from test_manager import TestManager
from routes import setup_routes

def get_local_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except:
        return "127.0.0.1"

app = Flask(__name__)
app.secret_key = 'local-test-secret'
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=False
)

# === ДОБАВЛЕНО: Логирование ===
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

# === ДОБАВЛЕНО: Логирование запросов ===
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
    if client_ip not in ['127.0.0.1', 'localhost']:
        return "❌ Доступ запрещён", 403
    return send_from_directory('static/teacher', 'index.html')

@app.route('/<path:path>')
def student_static(path):
    return send_from_directory('static/student', path)

@app.route('/teacher/<path:path>')
def teacher_static(path):
    client_ip = request.remote_addr
    if client_ip not in ['127.0.0.1', 'localhost']:
        return "❌ Доступ запрещён", 403
    return send_from_directory('static/teacher', path)

setup_routes(app, socketio, students_sessions, test_manager)

if __name__ == '__main__':
    local_ip = get_local_ip()
    print("\n" + "="*50)
    print("\x1b[32m🚀 ЛОКАЛЬНЫЙ ТЕСТ ЗАПУЩЕН\x1b[0m")
    print(f"🔹 IP: \x1b[33m{local_ip}\x1b[0m")
    print(f"🧑‍🎓 Ученики: http://{local_ip}:5000")
    print(f"👨‍🏫 Учитель: http://127.0.0.1:5000/teacher")
    print("="*50 + "\n")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)