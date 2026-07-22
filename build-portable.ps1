$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$DISCORD = Get-ChildItem "$env:LOCALAPPDATA\Discord" -Directory -Filter "app-*" | Sort-Object { [version]($_.Name -replace '^app-', '') } -Descending | Select-Object -First 1 -ExpandProperty FullName
$DISCORD_VERSION = (Split-Path $DISCORD -Leaf) -replace '^app-', ''
$OUT = Join-Path $Root "release\win-unpacked"
$RES = Join-Path $OUT "resources"

Write-Host "=== STEP 1a : Create app entry point (index.js) ===" -ForegroundColor Cyan
$ROOT_INDEX = Join-Path $Root "index.js"
$indexJs = @'
"use strict";
const path = require("path");
const { app } = require("electron");

app.setPath("userData", path.join(app.getPath("appData"), "Ghostcord"));
app.setAppUserModelId("com.squirrel.Discord.Discord");

require(path.join(__dirname, "dist", "desktop", "patcher.js"));
'@
Set-Content -Path $ROOT_INDEX -Value $indexJs -Encoding UTF8
Write-Host "index.js OK"

Write-Host "=== STEP 1 : Build ===" -ForegroundColor Cyan
Set-Location $Root
npx electron-builder --config electron-builder.config.cjs --win dir --x64

Write-Host "=== STEP 1b : Cleanup root index.js ===" -ForegroundColor Cyan
if (Test-Path $ROOT_INDEX) { Remove-Item $ROOT_INDEX -Force; Write-Host "index.js cleaned" }

Write-Host "=== STEP 2 : Copy _app.asar ===" -ForegroundColor Cyan
Copy-Item "$DISCORD\resources\_app.asar" "$RES\_app.asar" -Force
Write-Host "_app.asar OK"

Write-Host "=== STEP 3 : standalone_modules ===" -ForegroundColor Cyan
$MOD_SRC = "$DISCORD\modules"
$MOD_DST = "$RES\standalone_modules"
New-Item -ItemType Directory -Path $MOD_DST -Force | Out-Null

$modules = Get-ChildItem -Path $MOD_SRC -Directory
foreach ($mod in $modules) {
    $cleanName = $mod.Name -replace '-\d+$', ''
    $innerSrc = Join-Path $mod.FullName $cleanName
    $dst = Join-Path $MOD_DST $cleanName
    if (Test-Path $innerSrc) {
        Copy-Item -Recurse -Force -Path $innerSrc -Destination $dst
        Write-Host "  $cleanName OK"
    }
}

Write-Host "=== STEP 4 : build_info.json ===" -ForegroundColor Cyan
$buildInfo = "{`"newUpdater`":false,`"releaseChannel`":`"stable`",`"version`":`"$DISCORD_VERSION`",`"standaloneModules`":true}"
Set-Content -Path "$RES\build_info.json" -Value $buildInfo -Encoding UTF8
Write-Host "build_info.json OK"

Write-Host "=== STEP 5 : app/dist/_app.asar ===" -ForegroundColor Cyan
$APP_DIST = "$RES\app\dist"
New-Item -ItemType Directory -Path $APP_DIST -Force | Out-Null
Copy-Item "$DISCORD\resources\_app.asar" "$APP_DIST\_app.asar" -Force
Write-Host "app/dist/_app.asar OK"

Write-Host "=== STEP 6 : Create portable exe ===" -ForegroundColor Cyan
npx electron-builder --config electron-builder.config.cjs --win portable --x64 --prepackaged release\win-unpacked

Write-Host "=== DONE ===" -ForegroundColor Green
Get-ChildItem (Join-Path $Root "release\*.exe") | ForEach-Object { Write-Host "Fichier : $($_.FullName)" -ForegroundColor Green }
