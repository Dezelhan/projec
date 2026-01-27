@echo off
chcp 65001 >nul
title Podrabotka - Запуск сервера
color 0A

echo.

echo   PODRABOTKA - Автоматический запуск

echo.
echo Запуск веб-сервера...
echo.

cd /d "%~dp0"

REM Проверяем наличие Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не найден в системе!
    echo.
    echo Установите Node.js с официального сайта:
    echo https://nodejs.org/
    echo.
    echo После установки перезапустите этот файл
    echo.
    pause
    exit /b 1
)

REM Проверяем наличие npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] npm не найден в системе!
    echo.
    echo npm должен устанавливаться вместе с Node.js
    echo Переустановите Node.js с официального сайта
    echo.
    pause
    exit /b 1
)

REM Проверяем, установлены ли зависимости
if not exist "node_modules" (
    echo [ИНФО] Устанавливаю зависимости...
    call npm install
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Не удалось установить зависимости!
        echo.
        pause
        exit /b 1
    )
    echo [OK] Зависимости установлены
    echo.
)

REM Проверяем, не запущен ли уже сервер на порту 8000
netstat -an | findstr ":8000" >nul 2>&1
if %errorlevel% equ 0 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Порт 8000 уже занят!
    echo Возможно, сервер уже запущен.
    echo.
    echo Открываю браузер...
    timeout /t 2 >nul
    start http://localhost:8000
    echo.
    echo Браузер открыт. Если сервер не работает, закройте
    echo другие приложения, использующие порт 8000.
    pause
    exit /b 0
)

echo [OK] Node.js найден
echo [OK] npm найден
echo [OK] Порт 8000 свободен
echo.
echo Запускаю сервер на http://localhost:8000
echo.

echo   Сервер запущен!
echo   Браузер откроется автоматически через 2 секунды...
echo.
echo   Для остановки сервера нажмите Ctrl+C

echo.

REM Ждем немного перед открытием браузера
timeout /t 2 >nul

REM Открываем браузер
start http://localhost:8000

REM Запускаем Node.js сервер (блокирующий процесс)
node server.js

REM Если сервер остановлен
echo.
echo ═══════════════════════════════════════════════════════════
echo   Сервер остановлен
echo ═══════════════════════════════════════════════════════════
pause
