@echo off
echo 🔧 Устанавливаю зависимости...

if not exist venv (
    echo 🏗 Создаю виртуальное окружение...
    python -m venv venv
)

echo 📦 Активирую виртуальное окружение...
call venv\Scripts\activate.bat

echo 🚀 Устанавливаю пакеты...
pip install -r requirements.txt

echo 🎯 Запускаю сервер...
python app.py

pause