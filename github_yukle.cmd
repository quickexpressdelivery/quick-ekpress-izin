@echo off
title GitHub Repo Yukleyici - Quick Ekpress
color 0A
echo ===========================================================
echo   QUICK EKPRESS IZIN SISTEMI GITHUB'A YUKLENIYOR...
echo ===========================================================
echo.

cd /d "%~dp0"

"C:\Program Files\Git\cmd\git.exe" push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo ===========================================================
    echo [BASARILI] Kodlar basariyla GitHub'a yuklendi!
    echo Simdi Vercel.com uzerinden 1 tikla Deploy edebilirsiniz.
    echo ===========================================================
) else (
    echo ===========================================================
    echo [BILGI] Eger GitHub girisi istendiyse lutfen acilan
    echo pencereden "Sign in with browser" secenegiyle onay verin.
    echo ===========================================================
)

echo.
pause
