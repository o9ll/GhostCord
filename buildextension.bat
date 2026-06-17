@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo BUILDER EXTENSION FIREFOX NIGHTCORD
echo ========================================================
echo.
echo Liste des plugins ignores lue depuis blacklist.txt
echo.
echo Entrez la nouvelle version (ex: 1.20.0) :
set /p NEW_VERSION=

if "!NEW_VERSION!"=="" (
    echo Version invalide, annulation.
    pause
    exit /b
)

echo.
echo Mise a jour de package.json vers la version !NEW_VERSION!...
powershell -Command "(Get-Content package.json) -replace '\"version\": \".*\"', '\"version\": \"!NEW_VERSION!\"' | Set-Content package.json"

echo.
echo Construction de l'extension Firefox (cela peut prendre quelques instants)...
call pnpm buildWeb

echo.
echo Copie de l'extension vers C:\Users\zzafi\Documents\GitHub\nightcord\firefox...
if exist "C:\Users\zzafi\Documents\GitHub\nightcord\firefox" (
    rmdir /s /q "C:\Users\zzafi\Documents\GitHub\nightcord\firefox"
)
mkdir "C:\Users\zzafi\Documents\GitHub\nightcord\firefox"
xcopy /E /Y "dist\browser\firefox-unpacked\*" "C:\Users\zzafi\Documents\GitHub\nightcord\firefox\"

echo.
echo ========================================================
echo TERMINÉ ! L'extension est prete dans le dossier firefox.
echo ========================================================
pause
