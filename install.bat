@echo off
chcp 65001 >nul
echo ====================================
echo    Toolbox 安装向导
echo ====================================
echo.

echo [1/3] 检查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 Node.js，请先安装 Node.js 18.x 或更高版本
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js 已安装

echo.
echo [2/3] 安装后端依赖...
cd backend
call npm install
if errorlevel 1 (
    echo ❌ 后端依赖安装失败
    pause
    exit /b 1
)
echo ✅ 后端依赖安装完成

echo.
echo [3/3] 安装前端依赖...
cd ..\frontend
call npm install
if errorlevel 1 (
    echo ❌ 前端依赖安装失败
    pause
    exit /b 1
)
echo ✅ 前端依赖安装完成

cd ..
echo.
echo ====================================
echo    安装完成！
echo ====================================
echo.
echo 使用方式:
echo   1. 双击 start-backend.bat 启动后端
echo   2. 双击 start-frontend.bat 启动前端
echo   或者
echo   3. 双击 start-all.bat 同时启动
echo.
pause
