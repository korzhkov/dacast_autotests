   cd "$(dirname "$0")"
   nvm use 16
   xvfb-run npm run test:all:startfrom -- test:analytics