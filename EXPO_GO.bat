@echo off
title MyStoneINN - Expo Go SDK 57 (Telefon)
cd /d "%~dp0"
echo.
echo ========================================
echo   MyStoneINN - Expo Go (SDK 57)
echo ========================================
echo.
echo ONEMLI: Play Store Expo Go henuz SDK 57 desteklemiyor olabilir.
echo Projemiz Expo SDK 57 kullaniyor; magaza surumu eski kalabilir.
echo.
echo Android telefon icin DOGRU Expo Go surumunu yukleyin:
echo   https://expo.dev/go?sdkVersion=57^&platform=android^&device=true
echo.
echo Adimlar:
echo   1. Yukaridaki linkten APK indirip telefona kurun (Play Store degil)
echo   2. Telefon ve bilgisayar AYNI Wi-Fi aginda olsun
echo   3. Asagidaki QR kodu yeni Expo Go ile tarayin
echo.
echo Alternatif (IP ile calisan yontem):
echo   CALISTIR.bat veya npx expo start --lan --web
echo   veya APK_OLUSTUR.bat ile development build
echo.
echo Bu pencereyi KAPATMAYIN.
echo.
start "" "https://expo.dev/go?sdkVersion=57&platform=android&device=true"
npx expo start --lan
pause
