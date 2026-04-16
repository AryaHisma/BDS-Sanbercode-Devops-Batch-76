#!/bin/bash

echo "Memulai backup log ..."

mkdir -p backup-log

cp syslog.txt backup-log/
