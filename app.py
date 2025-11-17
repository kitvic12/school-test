from flask import Flask, send_from_directory
from flask_socketio import SocketIO
import os
import socket

def get_local_ip():
    """Получает локальный IP-адрес компьютера"""
    try:
        # Подключаемся к любому внешнему адресу (не отправляя данные)
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
        return ip
    except Exception:
        return "127.0.0.1"

app = Flask(__name__)
app.secret_key = 'local-test-secret'
socketio = SocketIO(app, cors_allowed_origins="*")

students_sessions = {}
from test_manager import TestManager
test_manager = TestManager()

os.makedirs('static/student', exist_ok=True)
os.makedirs('static/teacher', exist_ok=True)

@app.route('/')
def student():
    return send_from_directory('static/student', 'index.html')

@app.route('/teacher')
def teacher():
    return send_from_directory('static/teacher', 'index.html')

@app.route('/student/<path:path>')
def student_static(path):
    return send_from_directory('static/student', path)

@app.route('/teacher/<path:path>')
def teacher_static(path):
    return send_from_directory('static/teacher', path)

from routes import setup_routes
setup_routes(app, socketio, students_sessions, test_manager)

if __name__ == '__main__':
    local_ip = get_local_ip()
    print("\n" + "="*50)
    print("\x1b[32m🚀 ЛОКАЛЬНЫЙ ТЕСТ ЗАПУЩЕН\x1b[0m")
    print(f"🔹 Твой IP: \x1b[33m{local_ip}\x1b[0m")
    print(f"👨‍🏫 Учитель: http://{local_ip}:5000/teacher")
    print(f"🧑‍🎓 Ученики: http://{local_ip}:5000")
    print("="*50 + "\n")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)