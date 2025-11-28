import os
import socket
from flask import Flask, send_from_directory
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
    SESSION_COOKIE_SECURE=False,    
    PERMANENT_SESSION_LIFETIME=3600
)


socketio = SocketIO(app, cors_allowed_origins="*")

students_sessions = {}

from test_manager import TestManager
test_manager = TestManager()

os.makedirs('static/student', exist_ok=True)
os.makedirs('static/teacher', exist_ok=True)

STUDENT_DIR = os.path.join(os.path.dirname(__file__), 'static', 'student')
TEACHER_DIR = os.path.join(os.path.dirname(__file__), 'static', 'teacher')

@app.route('/')
def student():
    return send_from_directory(STUDENT_DIR, 'index.html')

@app.route('/teacher')
def teacher():
    return send_from_directory(TEACHER_DIR, 'index.html')

@app.route('/<path:path>')
def student_static(path):
    return send_from_directory(STUDENT_DIR, path)

@app.route('/teacher/<path:path>')
def teacher_static(path):
    return send_from_directory(TEACHER_DIR, path)

from routes import setup_routes
setup_routes(app, socketio, students_sessions, test_manager)

if __name__ == '__main__':
    local_ip = get_local_ip()
    print("\n" + "="*50)
    print("\x1b[32m🚀 ЛОКАЛЬНЫЙ ТЕСТ ЗАПУЩЕН\x1b[0m")
    print(f"🔹 IP: \x1b[33m{local_ip}\x1b[0m")
    print(f"👨‍🏫 Учитель: http://{local_ip}:5000/teacher")
    print(f"🧑‍🎓 Ученики: http://{local_ip}:5000")
    print("="*50 + "\n")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)