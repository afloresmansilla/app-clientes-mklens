FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js db.js lensCatalog.js parseo.js wallet.js ./

RUN mkdir -p /app/logos && chown node:node /app/logos

ENV NODE_ENV=production
ENV PORT=3080
ENV LOGOS_DIR=/app/logos

USER node

EXPOSE 3080

CMD ["node", "index.js"]
