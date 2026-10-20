FROM node:22-alpine AS build

WORKDIR /auth-automation

COPY auth-automation/package.json auth-automation/package-lock.json ./

RUN npm ci

COPY auth-automation/ ./

RUN npm run build

FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /auth-automation

COPY auth-automation/package.json auth-automation/package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /auth-automation/dist ./dist

COPY auth-automation/public ./public

USER node

EXPOSE 3000

CMD [ "node", "dist/main.js" ]
