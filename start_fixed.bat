@echo off
chcp 65001 > nul
cls

echo ========================================
echo   PODRABOTKA - Автоматический запуск
echo ========================================
echo.

echo Проверка занятости порта 8000...
netstat -ano | findstr ":8000" > nul

if %errorlevel% equ 0 (
    echo [INFO] Порт 8000 занят. Закрываю процессы...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do (
        echo Завершаю процесс с PID: %%a
        taskkill /PID %%a /F > nul 2>&1
        timeout /t 1 /nobreak > nul
    )
    echo Процессы завершены.
) else (
    echo [INFO] Порт 8000 свободен.
)

echo.
echo Запуск веб-сервера...
echo.

node server.js

echo.
echo ========================================
echo   Сервер остановлен
echo ========================================
pause