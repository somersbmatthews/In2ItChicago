pip3 install -r requirements.txt
scripts/render.sh
docker stack rm In2ItChicago
sleep 5
docker system prune -f
sleep 5
docker network create --attachable --driver overlay in2it > /dev/null 2>&1
./scripts/stack-deploy.sh prod
