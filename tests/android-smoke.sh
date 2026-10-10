#!/usr/bin/env bash
set -euo pipefail
mkdir -p ../native-evidence
adb install -r app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.waymark.nativeapp/.MainActivity
sleep 15
adb shell uiautomator dump /sdcard/window.xml
adb pull /sdcard/window.xml ../native-evidence/home.xml
adb exec-out screencap -p > ../native-evidence/home.png
grep -q 'Leave a mark' ../native-evidence/home.xml
adb shell input tap 520 1300
sleep 2
adb logcat -d -s AndroidRuntime:E > ../native-evidence/crashes.txt
! grep -q 'FATAL EXCEPTION' ../native-evidence/crashes.txt
