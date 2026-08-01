FROM node:20-slim

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY tracing.js index.js ./

EXPOSE 3000
CMD ["node", "--require", "./tracing.js", "index.js"]
