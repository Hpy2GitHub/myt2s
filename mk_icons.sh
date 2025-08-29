#!/usr/bin/bash
mkdir -p icons
convert -size 128x128 xc:none -fill "#4285f4" -draw "roundrectangle 0,0 128,128 20,20"   -fill white -draw "polygon 40,40 60,30 60,50 80,40 60,70 60,90 40,80 20,90 20,70 40,60 20,50 20,30"   icons/icon128.png
convert -size 48x48 xc:none -fill "#4285f4" -draw "roundrectangle 0,0 48,48 8,8"   -fill white -draw "polygon 15,15 23,11 23,19 31,15 23,26 23,34 15,30 7,34 7,26 15,22 7,19 7,11"   icons/icon48.png
convert -size 16x16 xc:"#4285f4" -fill white -draw "text 4,12 'R'" icons/icon16.png
