#!/bin/bash
echo "🔧 Устанавливаю зависимости..."

if [ ! -d "venv" ]; then
    echo "🏗 Создаю виртуальное окружение..."
    python3 -m venv venv
fi

echo "🚀 Активирую виртуальное окружение..."
source venv/bin/activate

echo "📦 Устанавливаю пакеты..."
pip install -r requirements.txt

echo "🎯 Запускаю сервер..."
python3 app.pyЗапускаю сервер..."
python3 app.py