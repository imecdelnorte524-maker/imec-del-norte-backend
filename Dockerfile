FROM node:20.12.2-bullseye

# Instalar wkhtmltopdf (necesario en todos los entornos)
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

# Copiar archivos de configuración
COPY package*.json ./
COPY tsconfig.json ./

# Instalar TODAS las dependencias (tanto dev como prod)
RUN npm install

# Copiar el resto del código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

EXPOSE 4001

# Verificar que los archivos existen
RUN ls -la dist/ && ls -la templates/

# Comando por defecto para producción
# Para desarrollo, puedes sobreescribir con docker run o docker-compose
CMD ["node", "dist/src/main"]