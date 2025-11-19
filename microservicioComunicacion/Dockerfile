FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm install --production=false

COPY . .

EXPOSE 4100

CMD ["node", "src/index.js"]
