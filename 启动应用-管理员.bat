@echo off
cd /d "d:\work\trae\Trae_projects\Deadline Guardian"
set PATH=C:\Program Files\nodejs;C:\Users\dolor\.cargo\bin;%PATH%
powershell -Command "Set-MpPreference -DisableBehaviorMonitoring $true; Set-MpPreference -DisableRealtimeMonitoring $true"
rmdir /s /q src-tauri\target 2>nul
echo Building... This may take 2-5 minutes.
npm.cmd run tauri dev
pause