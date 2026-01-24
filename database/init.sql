-- database/init.sql

-- Crear extensiones si es necesario
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de roles
CREATE TABLE IF NOT EXISTS roles (
    rol_id SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT
);

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    usuario_id SERIAL PRIMARY KEY,
    rol_id INTEGER NOT NULL REFERENCES roles(rol_id),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    email VARCHAR(150) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de servicios
CREATE TABLE IF NOT EXISTS servicios (
    servicio_id SERIAL PRIMARY KEY,
    nombre_servicio VARCHAR(150) UNIQUE NOT NULL,
    descripcion TEXT,
    precio_base DECIMAL(10,2) NOT NULL,
    duracion_estimada VARCHAR(50)
);

-- Tabla de equipos
CREATE TABLE IF NOT EXISTS equipos (
    equipo_id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    marca VARCHAR(100),
    serial VARCHAR(100) UNIQUE,
    modelo VARCHAR(100),
    caracteristicas_tecnicas VARCHAR(255),
    observacion TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo VARCHAR(50) NOT NULL,
    estado VARCHAR(50) NOT NULL,
    valor_unitario DECIMAL(10,2) NOT NULL,
    foto_url TEXT
);

-- Tabla de insumos
CREATE TABLE IF NOT EXISTS insumos (
    insumo_id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    unidad_medida VARCHAR(50) NOT NULL,
    stock INTEGER DEFAULT 0,
    estado VARCHAR(50) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stock_min INTEGER DEFAULT 0,
    valor_unitario DECIMAL(10,2) NOT NULL,
    foto_url TEXT
);

-- Tabla de inventario
CREATE TABLE IF NOT EXISTS inventario (
    inventario_id SERIAL PRIMARY KEY,
    insumo_id INTEGER REFERENCES insumos(insumo_id),
    equipo_id INTEGER REFERENCES equipos(equipo_id),
    cantidad_actual DECIMAL(10,2) DEFAULT 0,
    ubicacion VARCHAR(100),
    fecha_ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ubicacion, insumo_id, equipo_id)
);

-- Tabla de órdenes de trabajo
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
    orden_id SERIAL PRIMARY KEY,
    servicio_id INTEGER NOT NULL REFERENCES servicios(servicio_id),
    cliente_id INTEGER NOT NULL REFERENCES usuarios(usuario_id),
    tecnico_id INTEGER REFERENCES usuarios(usuario_id),
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_inicio TIMESTAMP,
    fecha_finalizacion TIMESTAMP,
    estado VARCHAR(50) DEFAULT 'Pendiente',
    comentarios TEXT
);

-- Tabla de detalles de insumos usados
CREATE TABLE IF NOT EXISTS detalles_insumo_usado (
    detalle_insumo_id SERIAL PRIMARY KEY,
    orden_id INTEGER NOT NULL REFERENCES ordenes_trabajo(orden_id),
    insumo_id INTEGER NOT NULL REFERENCES insumos(insumo_id),
    cantidad_usada DECIMAL(10,2) NOT NULL,
    costo_unitario_al_momento DECIMAL(10,2)
);

-- Tabla de detalles de equipo asignado
CREATE TABLE IF NOT EXISTS detalles_equipo_asignado (
    detalle_equipo_id SERIAL PRIMARY KEY,
    orden_id INTEGER NOT NULL REFERENCES ordenes_trabajo(orden_id),
    equipo_id INTEGER NOT NULL REFERENCES equipos(equipo_id),
    tiempo_uso VARCHAR(50),
    comentarios_uso TEXT
);