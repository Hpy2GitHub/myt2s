#!/usr/bin/bash
if [ -f myt2s.xpi ] 
then
    echo rm myt2s.xpi
    rm myt2s.xpi
fi
echo zip -r myt2s.xpi *
zip -r myt2s.xpi . -x 'bak/*' -x '*/bak/*' -x '*.sh' -x '*.xpi'
#zip  myt2s.xpi manifest.json background.js content.js icons/* options/* popup/*
ls -ald myt2s.xpi

