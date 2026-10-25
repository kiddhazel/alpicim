@echo off
rem Rust tarafini denetler ve test eder. Cikti: logs\rust.log
cd /d "%~dp0.."
if not exist logs mkdir logs
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
(cargo check --manifest-path src-tauri\Cargo.toml --color never && cargo test --manifest-path src-tauri\Cargo.toml --color never) > logs\rust.log 2>&1
echo exit=%ERRORLEVEL%>> logs\rust.log
