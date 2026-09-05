@echo off
set PATH=C:\Users\dolor\.cargo\bin;%PATH%
set PATH=C:\Users\dolor\.rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin\self-contained;%PATH%
set PATH=C:\Users\dolor\.rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin;%PATH%
set PATH=C:\Program Files\nodejs;%PATH%
rustup default stable-x86_64-pc-windows-gnu
npm run tauri dev
