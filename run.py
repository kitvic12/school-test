import subprocess
import sys
import os

def install_and_run():
    print("🔧 Устанавливаю зависимости...")
    
    if not os.path.exists('venv'):
        print("🏗 Создаю виртуальное окружение...")
        subprocess.run([sys.executable, '-m', 'venv', 'venv'])
    
    if os.name == 'nt':  
        pip_path = os.path.join('venv', 'Scripts', 'pip.exe')
        python_path = os.path.join('venv', 'Scripts', 'python.exe')
    else: 
        pip_path = os.path.join('venv', 'bin', 'pip')
        python_path = os.path.join('venv', 'bin', 'python')
    
    print("📦 Устанавливаю пакеты через виртуальное окружение...")
    result = subprocess.run([pip_path, 'install', '-r', 'requirements.txt'], capture_output=True, text=True)
    if result.returncode != 0:
        print("❌ Ошибка установки:")
        print(result.stderr)
        return
    
    print("🎯 Запускаю сервер Flask...")
    subprocess.run([python_path, 'app.py'], stdout=None, stderr=None)

if __name__ == '__main__':
    install_and_run()