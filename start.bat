@echo off
REM 限制 Cargo 并行编译数为 2，解决 Windows 页面文件太小/系统资源不足问题
set CARGO_BUILD_JOBS=2
npm run tauri dev
