FROM node:24.11.1-alpine As development

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:24.11.1-alpine as production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production

COPY --from=development /app/dist ./dist
COPY --from=development /app/src ./src

EXPOSE 4001

CMD ["node", "dist/src/main"]