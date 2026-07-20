@echo off
:: ─── Ghostcord — Publish a new release to GitHub ──────────────────────────────
:: Usage: publish-release.bat 1.18.1 "Release description"
:: Requires: gh (GitHub CLI) — https://cli.github.com
::           pnpm, node, dotnet SDK (or .NET Framework 4.x)

setlocal EnableDelayedExpansion

set "VERSION=%~1"
set "NOTES=%~2"

if "%VERSION%"=="" (
    echo [ERROR] Usage: publish-release.bat VERSION "Release notes"
    echo Example: publish-release.bat 1.18.1 "Fixed audio bug"
    pause
    exit /b 1
)

if "%NOTES%"=="" set NOTES=Ghostcord %VERSION%

:: Output paths
set DIST_DIR=dist\desktop
set OUT_DIR=release\installer
set DIST_ZIP=%OUT_DIR%\ghostcord-dist.zip
set INSTALLER_EXE=%OUT_DIR%\Ghostcord-Installer.exe
set VERSION_JSON=%OUT_DIR%\version.json
set DESKTOP_ASAR=dist\desktop.asar

echo.
echo  ╔═══════════════════════════════════════════════════╗
echo  ║    GHOSTCORD — Publishing release v%VERSION%
echo  ╚═══════════════════════════════════════════════════╝
echo.

:: ── 1. Update version numbers in files ─────────────────────────────────────────
echo  [1/8] Updating version to %VERSION%...

powershell -NoProfile -Command "$c = Get-Content -Raw 'package.json'; $c = $c -replace '\"version\": \"[^\"]+\"', '\"version\": \"%VERSION%\"'; [IO.File]::WriteAllText((Resolve-Path 'package.json').Path, $c)"

echo  [1/8] Version updated.

:: ── 2. Push source code to GitHub ──────────────────────────────────────────────
echo.
echo  [2/8] Committing and pushing source code...
git add .
git diff --quiet --cached
if errorlevel 1 (
    git commit -m "build: release v%VERSION% - !NOTES!"
) else (
    echo  No changes to commit.
)
git push --set-upstream origin master
if errorlevel 1 (
    echo  [ERROR] Unable to push to GitHub. Check your credentials/access rights.
    pause
    exit /b 1
)
echo  [2/8] Source code synchronized with GitHub.

:: ── 3. Build JS (with automatic obfuscation) ───────────────────────────────────
echo.
echo  [3/8] Building + obfuscating...
echo        (JavaScript files will be obfuscated automatically)

taskkill /F /IM Discord.exe /T >nul 2>&1
taskkill /F /IM node.exe    /T >nul 2>&1
timeout /t 2 /nobreak >nul

call pnpm build
if errorlevel 1 (
    echo  [ERROR] pnpm build failed.
    pause
    exit /b 1
)
echo  [3/8] Build + obfuscation completed!

:: ── 4. Prepare additional assets ───────────────────────────────────────────────
echo.
echo  [4/8] Copying assets (ffmpeg, node, modules...) to %DIST_DIR%...

node scripts\build\collect-assets.mjs

echo  [4/8] Assets copied.

:: ── 5. Compile Ghostcord-Installer.exe ─────────────────────────────────────────
echo.
echo  [5/8] Compiling Ghostcord-Installer.exe...

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "build-installer.ps1"
if errorlevel 1 (
    echo  [ERROR] Installer compilation failed.
    pause
    exit /b 1
)

if not exist "%INSTALLER_EXE%" (
    echo  [ERROR] Ghostcord-Installer.exe not found after compilation.
    pause
    exit /b 1
)

for %%F in ("%INSTALLER_EXE%") do echo  [5/8] Ghostcord-Installer.exe created (%%~zF bytes)

:: ── 6. Create ghostcord-dist.zip ───────────────────────────────────────────────
echo.
echo  [6/8] Creating ghostcord-dist.zip...

if not exist "%DIST_DIR%\patcher.js" (
    echo  [ERROR] dist\desktop\patcher.js not found.
    pause
    exit /b 1
)

if exist "%DIST_ZIP%" del /F /Q "%DIST_ZIP%"

:: Remove unnecessary files before compression
del /s /q "%DIST_DIR%\*.map" >nul 2>&1
del /s /q "%DIST_DIR%\*.LEGAL.txt" >nul 2>&1

:: Verify that @babel is present before creating the ZIP
node scripts\build\verify-dist.mjs
if errorlevel 1 (
    echo  [ERROR] Dist verification failed - @babel is missing or incomplete.
    pause
    exit /b 1
)

:: Compress directly using .NET ZipFile (more reliable than Compress-Archive for node_modules)
powershell -NoProfile -Command "Add-Type -Assembly System.IO.Compression.FileSystem; $src = (Resolve-Path '%DIST_DIR%').Path; $dst = (Join-Path (Resolve-Path 'release\installer').Path 'ghostcord-dist.zip'); [System.IO.Compression.ZipFile]::CreateFromDirectory($src, $dst, [System.IO.Compression.CompressionLevel]::Optimal, $false)"

if not exist "%DIST_ZIP%" (
    echo  [ERROR] Unable to create ghostcord-dist.zip
    pause
    exit /b 1
)

for %%F in ("%DIST_ZIP%") do echo  [6/8] ghostcord-dist.zip created (%%~zF bytes)

:: ── 7. Update version.json ─────────────────────────────────────────────────────
echo.
echo  [7/8] Updating version.json...

for /f "usebackq" %%d in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd'"`) do set ISO_DATE=%%d

(
    echo {
    echo   "version": "%VERSION%",
    echo   "releaseDate": "%ISO_DATE%",
    echo   "installerUrl": "https://github.com/o9ll/ghostcord/releases/latest/download/Ghostcord-Installer.exe",
    echo   "distUrl": "https://github.com/o9ll/ghostcord/releases/latest/download/ghostcord-dist.zip",
    echo   "downloadUrl": "https://github.com/o9ll/ghostcord/releases/latest/download/desktop.asar",
    echo   "changelog": "!NOTES!"
    echo }
) > "%VERSION_JSON%"

echo  [7/8] version.json updated.

:: ── 8. Publish to GitHub Releases ──────────────────────────────────────────────
echo.
echo  [8/8] Publishing release v%VERSION% to GitHub...

where gh >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] GitHub CLI is not installed — https://cli.github.com
    pause
    exit /b 1
)

gh release create "v%VERSION%" ^
    "%INSTALLER_EXE%#Ghostcord-Installer.exe" ^
    "%DIST_ZIP%#ghostcord-dist.zip" ^
    "%DESKTOP_ASAR%#desktop.asar" ^
    "%VERSION_JSON%#version.json" ^
    --repo o9ll/ghostcord ^
    --title "Ghostcord v%VERSION%" ^
    --notes "!NOTES!" ^
    --latest

if errorlevel 1 (
    echo  [ERROR] GitHub publication failed.
    pause
    exit /b 1
)

:: ── Done ───────────────────────────────────────────────────────────────────────
echo.
echo  ╔═══════════════════════════════════════════════════════════════╗
echo  ║  Ghostcord v%VERSION% published successfully!
echo  ║
echo  ║  Files published to GitHub:
echo  ║    Ghostcord-Installer.exe    — GUI installer
echo  ║    ghostcord-dist.zip         — Obfuscated JS (for injection)
echo  ║    version.json               — Version metadata
echo  ║
echo  ║  Users will download Ghostcord-Installer.exe
echo  ║  and run it to choose their target Discord installation.
echo  ║  No visible source code — everything is obfuscated.
echo  ╚═══════════════════════════════════════════════════════════════╝
echo.
pause