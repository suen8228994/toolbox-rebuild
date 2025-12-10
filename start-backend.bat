@echo off
chcp 65001 >nul
echo ====================================
echo    启动 Toolbox 后端服务
echo ====================================
echo.

cd backend

echo [1/2] 检查 dist 目录...
if not exist "dist" (
    echo ⚠️ 未找到构建文件，开始构建...
    call npm run build
    if errorlevel 1 (
        echo ❌ 构建失败
        pause
        exit /b 1
    )
)

echo [2/2] 启动后端服务...
echo.
echo 🚀 后端服务启动中...
echo 📡 HTTP Server: http://localhost:6790
echo 🔌 WebSocket: ws://localhost:6790
echo.

call npm start

pause
