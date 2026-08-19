@echo off
title MyStoneINN - Android APK Olustur
cd /d "%~dp0"
echo.
echo ========================================
echo   MyStoneINN Android APK Olusturma
echo ========================================
echo.
echo ONCE: APK_ONCESI.md dosyasindaki zorunlu maddeleri tamamlayin!
echo   - Rezervasyon push bildirimi (sunucu deploy + test)
echo   - Parmak izi / yuz tanima
echo   - EAS projectId (npx eas-cli init)
echo.
echo Bu islem Expo bulutunda APK uretir.
echo Ilk seferde expo.dev hesabi ile giris isteyebilir.
echo.
echo Komut: eas build -p android --profile preview
echo.
pause
call npx eas-cli build -p android --profile preview
echo.
echo APK hazir olunca expo.dev sitesinden indirebilirsiniz.
pause
