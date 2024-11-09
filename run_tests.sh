#!/bin/bash

# Настраиваем логирование
exec 1> >(tee -a "/home/ec2-user/cron_tests.log") 2>&1

echo "=== Test run started at $(date) ==="
echo "Current user: $(whoami)"
echo "Current directory before cd: $(pwd)"

# Переходим в директорию скрипта
cd "$(dirname "$0")"
echo "Changed directory to: $(pwd)"

# Проверяем переменные окружения
echo "PATH: $PATH"
echo "NODE_PATH: $NODE_PATH"
echo "NVM_DIR: $NVM_DIR"

# Загружаем NVM
echo "Loading NVM..."
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    echo "Found NVM script, sourcing it..."
    \. "$NVM_DIR/nvm.sh"
else
    echo "ERROR: NVM script not found at $NVM_DIR/nvm.sh"
fi

# Проверяем доступность nvm
echo "Checking NVM..."
which nvm || echo "NVM not found in PATH"

# Переключаем версию Node
echo "Switching to Node 16..."
nvm use 16 || echo "Failed to switch to Node 16"

# Проверяем версию Node
echo "Current Node version: $(node -v || echo 'Node not found')"

# Проверяем наличие xvfb
echo "Checking xvfb..."
which xvfb-run || echo "xvfb-run not found"

# Запускаем тесты
echo "Starting tests..."
xvfb-run node runTests2.js prod --sequential

echo "=== Test run finished at $(date) ==="