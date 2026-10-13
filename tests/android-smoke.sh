#!/usr/bin/env bash
set -euo pipefail
mkdir -p ../native-evidence
adb install -r app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.waymark.nativeapp/.MainActivity
sleep 15
capture() {
 adb shell uiautomator dump /sdcard/window.xml > /dev/null
 adb pull /sdcard/window.xml "../native-evidence/$1.xml" > /dev/null
 adb exec-out screencap -p > "../native-evidence/$1.png"
}
tap_label() {
 python3 - "$1" <<'PY'
import re,sys,subprocess,xml.etree.ElementTree as E
subprocess.run(['adb','shell','uiautomator','dump','/sdcard/window.xml'],check=True,stdout=subprocess.DEVNULL)
s=subprocess.check_output(['adb','shell','cat','/sdcard/window.xml']).decode()
for n in E.fromstring(s).iter('node'):
 if sys.argv[1] in [n.get('text'),n.get('content-desc')]:
  a=list(map(int,re.findall(r'\d+',n.get('bounds'))))
  subprocess.run(['adb','shell','input','tap',str((a[0]+a[2])//2),str((a[1]+a[3])//2)],check=True)
  break
else: raise SystemExit('Control missing: '+sys.argv[1])
PY
}
capture home
grep -q 'Leave a mark' ../native-evidence/home.xml
tap_label 'Save a new spot'
sleep 2
capture save-empty
grep -q 'Make it a memory' ../native-evidence/save-empty.xml
adb shell pm grant com.waymark.nativeapp android.permission.ACCESS_FINE_LOCATION
adb shell pm grant com.waymark.nativeapp android.permission.ACCESS_COARSE_LOCATION
adb emu geo fix 77.5995 12.9757
tap_label 'Use my location'
sleep 8
adb emu geo fix 77.5995 12.9757
sleep 5
tap_label 'Spot name'
adb shell input text 'The_car'
adb shell input keyevent 4
tap_label 'Spot note'
adb shell input text 'Level_2_blue_lift'
adb shell input keyevent 4
capture save-filled
grep -q 'Location ready' ../native-evidence/save-filled.xml
! grep -q 'Getting a fix' ../native-evidence/save-filled.xml
tap_label 'Keep this spot'
sleep 2
capture home-saved
grep -q 'The_car' ../native-evidence/home-saved.xml
tap_label 'Find The_car'
sleep 8
capture guide
grep -q 'Open in Google Maps' ../native-evidence/guide.xml
tap_label 'End guide'
sleep 2
adb shell am force-stop com.waymark.nativeapp
adb shell am start -n com.waymark.nativeapp/.MainActivity
sleep 8
capture home-reopened
grep -q 'The_car' ../native-evidence/home-reopened.xml
adb logcat -d -s AndroidRuntime:E > ../native-evidence/crashes.txt
! grep -q 'FATAL EXCEPTION' ../native-evidence/crashes.txt
