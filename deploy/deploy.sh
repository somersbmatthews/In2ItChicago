#!/bin/bash
cd ndscheduler
git checkout .
git pull

cd ../In2ItChicago
git checkout .
git pull
chmod +x start-prod.sh
./start-prod.sh
