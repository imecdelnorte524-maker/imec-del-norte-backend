# scripts/init-project.sh
#!/bin/bash

echo "🚀 Inicializando proyecto IMEC del Norte..."

# 1. Verificar que src/data-source.ts existe
if [ ! -f "src/data-source.ts" ]; then
    echo "❌ Error: src/data-source.ts no encontrado"
    echo "Por favor crea el archivo con la configuración de migraciones ordenadas"
    exit 1
fi

# 2. Renombrar migración con typo si aún existe
if [ -f "src/migrations/1764679551894-AddReltionsforusers.ts" ]; then
    echo "🔧 Renombrando migración con typo..."
    mv src/migrations/1764679551894-AddReltionsforusers.ts src/migrations/1764679551894-AddRelationsForUsers.ts
fi

# 3. Instalar dependencias si es necesario
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

# 4. Construir proyecto
echo "🔨 Construyendo proyecto..."
npm run build

# 5. Iniciar con Docker
echo "🐳 Iniciando con Docker..."
make down-volumes
make build
make start

echo ""
echo "⏳ Esperando que los servicios se inicien..."
sleep 10

# 6. Verificar estado
echo ""
echo "📊 Verificando estado:"
make status

echo ""
echo "🎉 ¡Proyecto inicializado!"
echo "📝 Comandos útiles:"
echo "   make logs           - Ver logs del backend"
echo "   make db-migrate     - Ejecutar migraciones"
echo "   make emergency-fix  - Arreglo de emergencia"
echo "   make status         - Ver estado del sistema"