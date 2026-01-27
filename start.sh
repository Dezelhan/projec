#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'Ё
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

clear
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  PODRABOTKA - Автоматический запуск"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Переходим в директорию скрипта
cd "$(dirname "$0")"

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ОШИБКА]${NC} Node.js не найден в системе!"
    echo ""
    echo "Установите Node.js с официального сайта:"
    echo "  https://nodejs.org/"
    echo ""
    echo "Или через пакетный менеджер:"
    echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  macOS: brew install node"
    echo ""
    exit 1
fi

# Проверяем наличие npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ОШИБКА]${NC} npm не найден в системе!"
    echo ""
    echo "npm должен устанавливаться вместе с Node.js"
    echo "Переустановите Node.js"
    echo ""
    exit 1
fi

# Проверяем, установлены ли зависимости
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[ИНФО]${NC} Устанавливаю зависимости..."
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ОШИБКА]${NC} Не удалось установить зависимости!"
        exit 1
    fi
    echo -e "${GREEN}[OK]${NC} Зависимости установлены"
    echo ""
fi

# Проверяем, не запущен ли уже сервер на порту 8000
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}[ПРЕДУПРЕЖДЕНИЕ]${NC} Порт 8000 уже занят!"
    echo "Возможно, сервер уже запущен."
    echo ""
    echo "Открываю браузер..."
    sleep 2
    
    # Определяем команду для открытия браузера
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open http://localhost:8000
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open http://localhost:8000 2>/dev/null || sensible-browser http://localhost:8000 2>/dev/null || firefox http://localhost:8000 &
    fi
    
    echo ""
    echo "Браузер открыт. Если сервер не работает, закройте"
    echo "другие приложения, использующие порт 8000."
    read -p "Нажмите Enter для выхода..."
    exit 0
fi

echo -e "${GREEN}[OK]${NC} Node.js найден"
echo -e "${GREEN}[OK]${NC} npm найден"
echo -e "${GREEN}[OK]${NC} Порт 8000 свободен"
echo ""
echo "Запускаю сервер на http://localhost:8000"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Сервер запущен!"
echo "  Браузер откроется автоматически через 2 секунды..."
echo ""
echo "  Для остановки сервера нажмите Ctrl+C"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Ждем немного перед открытием браузера
sleep 2

# Открываем браузер
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:8000 &
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:8000 2>/dev/null || sensible-browser http://localhost:8000 2>/dev/null || firefox http://localhost:8000 &
fi

# Запускаем Node.js сервер (блокирующий процесс)
node server.js

# Если сервер остановлен
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Сервер остановлен"
echo "═══════════════════════════════════════════════════════════"
read -p "Нажмите Enter для выхода..."
