@echo off
chcp 65001 >nul
echo ====================================
echo    启动 Toolbox 前端应用
echo ====================================
echo.

cd frontend

echo 🚀 前端应用启动中...
echo ⚠️ 请确保后端服务已启动
echo.

call npm start

pause
