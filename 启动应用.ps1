#Requires -RunAsAdministrator

Set-MpPreference -DisableBehaviorMonitoring $true
Set-MpPreference -DisableRealtimeMonitoring $true

$env:PATH = "C:\Program Files\nodejs;C:\Users\dolor\.cargo\bin;" + $env:PATH
Set-Location "d:\work\trae\Trae_projects\Deadline Guardian"

Remove-Item -Recurse -Force src-tauri\target -ErrorAction SilentlyContinue

Write-Host "Building... This may take 2-5 minutes." -ForegroundColor Cyan
npm.cmd run tauri dev