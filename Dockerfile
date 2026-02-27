# Etapa de desarrollo - con nombre explícito
FROM node:20.12.2-bullseye AS development

# Instalar wkhtmltopdf
RUN apt-get update && apt-get install -y \
  xfonts-75dpi \
  xfonts-base \
  fontconfig \
  libjpeg62-turbo \
  libxrender1 \
  libxtst6 \
  libssl1.1 \
  wkhtmltopdf \
  && rm -rf /var/lib/apt/lists/*

# Verificar instalación
RUN wkhtmltopdf --version

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY . .

RUN npm run build

# Etapa de producción
FROM node:20.12.2-bullseye AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Instalar wkhtmltopdf también en producción
RUN apt-get update && apt-get install -y \
  xfonts-75dpi \
  xfonts-base \
  fontconfig \
  libjpeg62-turbo \
  libxrender1 \
  libxtst6 \
  libssl1.1 \
  wkhtmltopdf \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar package.json y instalar dependencias de producción
COPY package*.json ./
RUN npm install --only=production

# Copiar archivos compilados desde la etapa development
COPY --from=development /app/dist ./dist
COPY --from=development /app/templates ./templates

EXPOSE 4001

# Verificar que los archivos existen (útil para debugging)
RUN ls -la dist/ && ls -la templates/

CMD ["node", "dist/src/main"]