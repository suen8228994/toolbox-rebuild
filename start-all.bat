@echo off
chcp 65001 >nul
echo ====================================
echo    启动 Toolbox 完整应用
echo ====================================
echo.

echo [1/2] 启动后端服务...
start "Toolbox Backend" cmd /k "cd backend && npm run build && npm start"

echo [2/2] 等待后端启动...
timeout /t 5 /nobreak >nul

echo [3/3] 启动前端应用...
cd frontend
call npm start

pause
