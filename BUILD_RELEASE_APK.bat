@echo off
setlocal
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

cd /d "%~dp0android"
echo.
echo === MyStoneINN Release APK derleniyor ===
call gradlew.bat clean assembleRelease --no-daemon
if errorlevel 1 (
  echo DERLEME BASARISIZ
  exit /b 1
)

copy /Y "app\build\outputs\apk\release\app-release.apk" "%USERPROFILE%\Downloads\MyStoneINN-release-v1.0.3.apk"
echo.
echo HAZIR: %USERPROFILE%\Downloads\MyStoneINN-release-v1.0.3.apk
explorer.exe /select,"%USERPROFILE%\Downloads\MyStoneINN-release-v1.0.3.apk"
endlocal
