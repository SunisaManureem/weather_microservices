# display/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
# ใช้ npm install แทน npm ci เพื่อไม่ติด lockfile mismatch
RUN npm install --omit=dev
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
