@echo off
chcp 65001 >nul
set PATH=C:\Program Files\nodejs;C:\Users\dolor\.cargo\bin;%PATH%
cd /d "d:\work\trae\Trae_projects\Deadline Guardian"
echo ============================================
echo    Deadline Guardian - 启动器
echo ============================================
echo.
echo [1/3] 清理旧构建文件...
rmdir /s /q src-tauri\target 2>nul
echo 完成
echo.
echo [2/3] 检查环境...
node -v
npm.cmd -v
echo.
echo [3/3] 启动应用（首次构建约2-5分钟）...
echo.
npm.cmd run tauri dev
pause