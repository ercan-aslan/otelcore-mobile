@echo off
title MyStoneINN Mobil Uygulama
cd /d "%~dp0"
echo MyStoneINN uygulamasi baslatiliyor...
echo Tarayici bir kac saniye icinde acilacak.
echo Bu pencereyi KAPATMAYIN.
npx expo start --web --port 8082
