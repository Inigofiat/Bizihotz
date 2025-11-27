FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Asegura que jsonwebtoken (y demás deps) estén disponibles dentro de la imagen
RUN npm install jsonwebtoken
EXPOSE 4001
CMD ["node", "src/index.js"]
