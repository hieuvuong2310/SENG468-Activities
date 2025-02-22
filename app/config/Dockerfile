# cart-service/Dockerfile
FROM node:20.17.0-alpine

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "deleteQueue.js"]
