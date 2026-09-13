@echo off
title TextSplit
cd /d "%~dp0"

echo.
echo ========================================
echo               TextSplit
echo ========================================
echo.

set "PYTHON_COMMAND="

where python >nul 2>nul
if %errorlevel% equ 0 (
    set "PYTHON_COMMAND=python"
)

if not defined PYTHON_COMMAND (
    where py >nul 2>nul
    if %errorlevel% equ 0 (
        set "PYTHON_COMMAND=py"
    )
)

if not defined PYTHON_COMMAND (
    echo Python was not found.
    echo.
    echo Install Python from:
    echo https://www.python.org/downloads/
    echo.
    echo During installation, select:
    echo Add Python to PATH
    echo.
    pause
    exit /b 1
)

echo Checking required package...
echo.

%PYTHON_COMMAND% -m pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo.
    echo TextSplit could not install its required package.
    echo Check your internet connection and try again.
    echo.
    pause
    exit /b 1
)

echo.
echo Starting TextSplit...
echo.

%PYTHON_COMMAND% split_chapters.py

echo.
pause