FROM node:20-slim

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY tracing.js index.js ./

CMD ["node", "--require", "./tracing.js", "index.js"]
