import subprocess
import sys
import os

def install_and_run():
    print("🔧 Устанавливаю зависимости...")
    

    if not os.path.exists('venv'):
        print("🏗 Создаю виртуальное окружение...")
        subprocess.run([sys.executable, '-m', 'venv', 'venv'])
    

    if os.name == 'nt':  
        pip_path = os.path.join('venv', 'Scripts', 'pip')
        python_path = os.path.join('venv', 'Scripts', 'python')
    else: 
        pip_path = os.path.join('venv', 'bin', 'pip')
        python_path = os.path.join('venv', 'bin', 'python')
    
    print("📦 Устанавливаю пакеты...")
    subprocess.run([pip_path, 'install', '-r', 'requirements.txt'])
    
    print("🎯 Запускаю сервер...")
    subprocess.run([python_path, 'app.py'])

if __name__ == '__main__':
    install_and_run()