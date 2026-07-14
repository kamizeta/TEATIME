FROM node:24-alpine

RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
RUN chown -R node:node /app
USER node
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start -- --hostname 0.0.0.0"]
