#!/bin/bash

echo ""
echo "Проверка Node.js..."

if ! command -v node &> /dev/null; then
    echo "[ОШИБКА] Node.js не найден!"
    echo ""
    echo "Установите Node.js с https://nodejs.org/"
    echo ""
    exit 1
fi

echo "[OK] Node.js найден"
echo ""

node view-users.js
