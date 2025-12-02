import os
import socket
from flask import Flask, send_from_directory, request, jsonify, session
from flask_socketio import SocketIO

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

socketio = SocketIO(app, cors_allowed_origins="*")

students_sessions = {}
from test_manager import TestManager
test_manager = TestManager()

os.makedirs('static/student', exist_ok=True)
os.makedirs('static/teacher', exist_ok=True)

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

from routes import setup_routes
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