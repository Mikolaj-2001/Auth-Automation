FROM node:22-alpine AS build

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . ./

RUN npx prisma generate && npm run build

FROM node:22-alpine

RUN apk add --no-cache openssl 
ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./ 

RUN npm ci --omit=dev && npm cache clean --force 

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist  

COPY public ./public

USER node

EXPOSE 3000

CMD [ "node", "dist/main.js" ]
