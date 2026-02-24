#!/bin/bash
set -e
echo "Deploying Retention Center to 38.180.64.126..."

rsync -avz \
  -e 'ssh -o StrictHostKeyChecking=no' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='*.db' \
  --exclude='.DS_Store' \
  --exclude='tsconfig.tsbuildinfo' \
  /Users/sky/retention-center/ root@38.180.64.126:/opt/retention-center/

ssh -o StrictHostKeyChecking=no root@38.180.64.126 '
  cd /opt/retention-center &&
  npm install &&
  npx prisma generate &&
  npx prisma db push &&
  npm run build &&
  systemctl restart retention-center
'

echo "Deploy complete! Checking service status..."
ssh -o StrictHostKeyChecking=no root@38.180.64.126 \
  'systemctl is-active retention-center && echo "Service is running!"'
