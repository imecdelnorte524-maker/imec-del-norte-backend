import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1774533396326 implements MigrationInterface {
  name = 'InitialSchema1774533396326';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * BASELINE SAFE GUARD
     * - Si ya existe el schema real o ya existe la tabla de migraciones, NO ejecutar nada.
     */
    const hasModulos = await queryRunner.hasTable('modulos');

    if (hasModulos) {
      return;
    }

    /**
     * Protección extra: si hay tablas sueltas pero no está el schema completo,
     * evita ejecutar el SQL en un entorno no-vacío.
     */
    const hasRoles = await queryRunner.hasTable('roles');
    const hasUsuarios = await queryRunner.hasTable('usuarios');
    const hasServicios = await queryRunner.hasTable('servicios');

    const looksPartial = hasRoles || hasUsuarios || hasServicios;
    if (looksPartial) {
      throw new Error(
        'InitialSchema: se detectó un esquema parcial (roles/usuarios/servicios existen). ' +
          'No es seguro aplicar InitialSchema aquí. Usa una BD realmente vacía.',
      );
    }

    // Evitar timeouts durante creación inicial
    await queryRunner.query(`SET statement_timeout TO 0;`);

    const sql = `
      CREATE TYPE "ac_inspections_phase_enum" AS ENUM ('BEFORE', 'AFTER');
CREATE TYPE "clientes_tipo_cliente_enum" AS ENUM ('juridica', 'natural');
CREATE TYPE "enum_ordenes_trabajo_estado_facturacion" AS ENUM ('No facturado', 'Facturado');
CREATE TYPE "equipos_categoria_equipo_enum" AS ENUM ('Aires Acondicionados', 'Redes Contra Incendios', 'Redes Eléctricas', 'Obras Civiles');
CREATE TYPE "equipos_estado_equipo_enum" AS ENUM ('Activo', 'Fuera de Servicio', 'Dado de Baja');
CREATE TYPE "forms_formtype_enum" AS ENUM ('ATS', 'HEIGHT_WORK', 'PREOPERATIONAL');
CREATE TYPE "forms_status_enum" AS ENUM ('DRAFT', 'PENDING_SST', 'COMPLETED', 'REJECTED');
CREATE TYPE "herramientas_estado_enum" AS ENUM ('Disponible', 'En Uso', 'En Mantenimiento', 'Dañado', 'Retirado');
CREATE TYPE "herramientas_motivo_eliminacion_enum" AS ENUM ('Dañado', 'Robado', 'Obsoleto', 'Donado', 'Vendido', 'Perdido', 'Retirado', 'Otro');
CREATE TYPE "herramientas_tipo_enum" AS ENUM ('Herramienta', 'Equipo');
CREATE TYPE "images_evidence_phase_enum" AS ENUM ('BEFORE', 'DURING', 'AFTER');
CREATE TYPE "insumos_categoria_enum" AS ENUM ('General', 'Eléctrico', 'Mecánico', 'Plomería', 'Carpintería', 'Electrónico', 'Herrajes');
CREATE TYPE "insumos_estado_enum" AS ENUM ('Disponible', 'Agotado', 'Stock Bajo', 'Inactivo');
CREATE TYPE "notificaciones_modulo_enum" AS ENUM ('work_orders', 'inventory', 'users', 'sst', 'payments', 'system');
CREATE TYPE "notificaciones_prioridad_enum" AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE "notificaciones_tipo_enum" AS ENUM ('WORK_ORDER_CREATED', 'WORK_ORDER_ASSIGNED', 'WORK_ORDER_COMPLETED', 'WORK_ORDER_CANCELLED', 'WORK_ORDER_INVOICED', 'WORK_ORDER_IN_PROGRESS', 'STOCK_BELOW_MIN', 'STOCK_EXPIRING', 'STOCK_OUT', 'INVENTORY_ADJUSTED', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_LOGIN_NEW_DEVICE', 'SST_DOCUMENT_EXPIRING', 'SST_EXPIRED', 'SST_ACCIDENT_REPORTED', 'SST_INSPECTION_DUE', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'PAYMENT_REMINDER', 'INVOICE_GENERATED', 'SYSTEM_MAINTENANCE', 'SYSTEM_UPDATE', 'SYSTEM_BACKUP_COMPLETED', 'SYSTEM_ERROR');
CREATE TYPE "ordenes_trabajo_estado_enum" AS ENUM ('Solicitada sin asignar', 'Solicitada asignada', 'En proceso', 'En pausa', 'Finalizada', 'Cancelada');
CREATE TYPE "ordenes_trabajo_estado_facturacion_enum" AS ENUM ('', 'Sin facturar', 'Por facturar', 'Facturada', 'Garantía');
CREATE TYPE "ordenes_trabajo_estado_pago_enum" AS ENUM ('', 'Por pagar', 'Pagado');
CREATE TYPE "ordenes_trabajo_tipo_servicio_enum" AS ENUM ('Mantenimiento', 'Instalación', 'Mantenimiento e Instalación');
CREATE TYPE "plan_mantenimiento_unidad_frecuencia_enum" AS ENUM ('DIA', 'SEMANA', 'MES');
CREATE TYPE "preoperational_checklist_parameters_category_enum" AS ENUM ('safety', 'functional', 'visual', 'operational', 'electrical');
CREATE TYPE "preoperational_checks_value_enum" AS ENUM ('GOOD', 'BAD', 'REGULAR', 'YES', 'NO');
CREATE TYPE "service_request_type_enum" AS ENUM ('Mantenimiento', 'Instalación', 'Mantenimiento e Instalación');
CREATE TYPE "servicios_categoria_servicio_enum" AS ENUM ('Aires Acondicionados', 'Redes Contra Incendios', 'Redes Eléctricas', 'Obras Civiles');
CREATE TYPE "sign_otps_signaturetype_enum" AS ENUM ('TECHNICIAN', 'SST');
CREATE TYPE "signatures_signaturetype_enum" AS ENUM ('TECHNICIAN', 'SST');
CREATE TYPE "supply_category_enum" AS ENUM ('General', 'Eléctrico', 'Mecánico', 'Plomería', 'Carpintería', 'Electrónico', 'Herrajes');
CREATE TYPE "supply_status_enum" AS ENUM ('Disponible', 'Agotado', 'Stock Bajo', 'Inactivo');
CREATE TYPE "tool_status_enum" AS ENUM ('Disponible', 'En Uso', 'En Mantenimiento', 'Dañado', 'Retirado');
CREATE TYPE "tool_type_enum" AS ENUM ('Herramienta', 'Instrumento', 'Equipo', 'Maquinaria', 'Electrónico');
CREATE TYPE "unit_of_measure_enum" AS ENUM ('Unidad', 'Metro', 'Kilogramo', 'Litro', 'Caja', 'Paquete', 'Rollo', 'Pulgada');
CREATE TYPE "usuarios_genero_enum" AS ENUM ('MASCULINO', 'FEMENINO', 'NO_BINARIO');
CREATE TYPE "usuarios_tipo_cedula_enum" AS ENUM ('CC', 'PPT');

CREATE SEQUENCE ac_inspections_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE air_conditioner_types_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE areas_id_area_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE ats_reports_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE bodegas_bodega_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE clientes_id_cliente_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE detalles_herramienta_asignado_detalle_herramienta_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE detalles_insumo_usado_detalle_insumo_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE equipment_compressors_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE equipment_condensers_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE equipment_documents_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE equipment_evaporators_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE equipment_motors_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE equipment_work_order_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE equipos_equipo_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE forms_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE generated_pdfs_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE height_works_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE herramientas_herramienta_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE images_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE insumos_insumo_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE inventario_inventario_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE modulos_modulo_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE notificaciones_notificacion_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE ordenes_trabajo_orden_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE ordenes_trabajo_pausas_pause_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE ordenes_trabajo_planes_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE ordenes_trabajo_tecnicos_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE ordenes_trabajo_timer_timer_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE plan_mantenimiento_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE preoperational_checklist_parameters_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE preoperational_checklist_templates_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE preoperational_checks_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE roles_rol_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE servicios_servicio_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE sign_otps_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE signatures_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE sub_areas_id_sub_area_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE tecnicos_ranking_historico_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE tipos_mantenimiento_tipo_mantenimiento_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE unidades_medida_unidad_medida_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE user_password_history_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE usuarios_usuario_id_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE;

CREATE TABLE air_conditioner_types (
	id serial4 NOT NULL,
	"name" varchar(150) NOT NULL,
	has_evaporator bool DEFAULT false NOT NULL,
	has_condenser bool DEFAULT false NOT NULL,
	CONSTRAINT air_conditioner_types_name_key UNIQUE (name),
	CONSTRAINT air_conditioner_types_pkey PRIMARY KEY (id)
);

CREATE TABLE clientes (
	id_cliente serial4 NOT NULL,
	nombre varchar(255) NOT NULL,
	nit varchar(20) NULL,
	direccion_base varchar(255) NOT NULL,
	barrio varchar(100) NULL,
	ciudad varchar(100) NOT NULL,
	departamento varchar(100) NULL,
	pais varchar(100) DEFAULT 'Colombia'::character varying NULL,
	direccion_completa varchar(500) NULL,
	contacto varchar(100) NOT NULL,
	email varchar NULL,
	telefono varchar(20) NOT NULL,
	localizacion varchar(500) NULL,
	fecha_creacion_empresa date NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	updated_at timestamp DEFAULT now() NOT NULL,
	digito_verificacion varchar NULL,
	tipo_cliente public."clientes_tipo_cliente_enum" DEFAULT 'juridica'::clientes_tipo_cliente_enum NOT NULL,
	CONSTRAINT clientes_pkey PRIMARY KEY (id_cliente)
);

CREATE TABLE herramientas (
	herramienta_id serial4 NOT NULL,
	nombre varchar(100) NOT NULL,
	marca varchar(100) NULL,
	serial varchar(100) NULL,
	modelo varchar(100) NULL,
	caracteristicas_tecnicas varchar(255) NULL,
	observacion text NULL,
	fecha_registro timestamp DEFAULT now() NOT NULL,
	fecha_actualizacion timestamp DEFAULT now() NOT NULL,
	fecha_eliminacion timestamp NULL,
	tipo public."herramientas_tipo_enum" DEFAULT 'Herramienta'::herramientas_tipo_enum NOT NULL,
	estado public."herramientas_estado_enum" DEFAULT 'Disponible'::herramientas_estado_enum NOT NULL,
	motivo_eliminacion public."herramientas_motivo_eliminacion_enum" NULL,
	observacion_eliminacion varchar(500) NULL,
	valor_unitario numeric(10, 2) NOT NULL,
	CONSTRAINT herramientas_pkey PRIMARY KEY (herramienta_id),
	CONSTRAINT herramientas_serial_key UNIQUE (serial)
);

CREATE TABLE modulos (
	modulo_id serial4 NOT NULL,
	nombre_modulo varchar(100) NOT NULL,
	descripcion text NULL,
	activo bool DEFAULT true NOT NULL,
	orden int4 DEFAULT 0 NOT NULL,
	ruta_frontend varchar(255) NULL,
	icono varchar(50) NULL,
	codigo_interno varchar(50) NULL,
	fecha_creacion timestamp DEFAULT now() NOT NULL,
	fecha_actualizacion timestamp DEFAULT now() NOT NULL,
	CONSTRAINT modulos_codigo_interno_key UNIQUE (codigo_interno),
	CONSTRAINT modulos_nombre_modulo_key UNIQUE (nombre_modulo),
	CONSTRAINT modulos_pkey PRIMARY KEY (modulo_id)
);

CREATE TABLE preoperational_checklist_templates (
	id serial4 NOT NULL,
	tool_type varchar NOT NULL,
	tool_category varchar NOT NULL,
	"estimatedTime" int4 DEFAULT 10 NOT NULL,
	"additionalInstructions" text NULL,
	"requiresTools" jsonb NULL,
	"isActive" bool DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "PK_38f3896f353faf9201536995b3e" PRIMARY KEY (id)
);

CREATE TABLE roles (
	rol_id serial4 NOT NULL,
	nombre_rol varchar(50) NOT NULL,
	descripcion varchar NULL,
	fecha_creacion timestamp DEFAULT now() NOT NULL,
	CONSTRAINT roles_nombre_rol_key UNIQUE (nombre_rol),
	CONSTRAINT roles_pkey PRIMARY KEY (rol_id)
);

CREATE TABLE servicios (
	servicio_id serial4 NOT NULL,
	nombre_servicio varchar(150) NOT NULL,
	descripcion text NULL,
	duracion_estimada varchar(50) NULL,
	categoria_servicio public."servicios_categoria_servicio_enum" NOT NULL,
	CONSTRAINT servicios_nombre_servicio_key UNIQUE (nombre_servicio),
	CONSTRAINT servicios_pkey PRIMARY KEY (servicio_id)
);

CREATE TABLE tecnicos_ranking_historico (
	id serial4 NOT NULL,
	tecnico_id int4 NOT NULL,
	mes int4 NOT NULL,
	año int4 NOT NULL,
	puesto int4 NOT NULL,
	puntaje_total numeric(5, 2) NOT NULL,
	calificacion_promedio numeric(3, 1) NOT NULL,
	total_ordenes int4 NOT NULL,
	puntualidad numeric(3, 1) NOT NULL,
	veces_lider int4 NOT NULL,
	metadata text NULL,
	fecha_calculo timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "PK_a9b7e24d20cf9b4de654bfe5401" PRIMARY KEY (id)
);
CREATE UNIQUE INDEX "IDX_42d42a7d5a608c1312477d3c82" ON public.tecnicos_ranking_historico USING btree (mes, "año", tecnico_id);

CREATE TABLE tipos_mantenimiento (
	tipo_mantenimiento_id serial4 NOT NULL,
	nombre varchar(100) NOT NULL,
	descripcion text NULL,
	activo bool DEFAULT true NOT NULL,
	CONSTRAINT tipos_mantenimiento_nombre_key UNIQUE (nombre),
	CONSTRAINT tipos_mantenimiento_pkey PRIMARY KEY (tipo_mantenimiento_id)
);

CREATE TABLE unidades_medida (
	unidad_medida_id serial4 NOT NULL,
	nombre varchar(50) NOT NULL,
	abreviatura varchar(10) NULL,
	activa bool DEFAULT true NOT NULL,
	fecha_creacion timestamp DEFAULT now() NOT NULL,
	fecha_actualizacion timestamp DEFAULT now() NOT NULL,
	CONSTRAINT unidades_medida_nombre_key UNIQUE (nombre),
	CONSTRAINT unidades_medida_pkey PRIMARY KEY (unidad_medida_id)
);

CREATE TABLE areas (
	id_area serial4 NOT NULL,
	nombre_area varchar(255) NOT NULL,
	cliente_id int4 NOT NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	updated_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT areas_pkey PRIMARY KEY (id_area),
	CONSTRAINT "FK_4318d5e11e15f48f493971c12f1" FOREIGN KEY (cliente_id) REFERENCES clientes(id_cliente)
);

CREATE TABLE bodegas (
	bodega_id serial4 NOT NULL,
	nombre varchar(100) NOT NULL,
	descripcion text NULL,
	direccion varchar(200) NULL,
	activa bool DEFAULT true NOT NULL,
	cliente_id int4 NULL,
	fecha_creacion timestamp DEFAULT now() NOT NULL,
	fecha_actualizacion timestamp DEFAULT now() NOT NULL,
	fecha_eliminacion timestamp NULL,
	CONSTRAINT bodegas_nombre_key UNIQUE (nombre),
	CONSTRAINT bodegas_pkey PRIMARY KEY (bodega_id),
	CONSTRAINT "FK_59c59f6711defdd07399a799e29" FOREIGN KEY (cliente_id) REFERENCES clientes(id_cliente) ON DELETE SET NULL
);

CREATE TABLE insumos (
	insumo_id serial4 NOT NULL,
	nombre varchar(100) NOT NULL,
	categoria public."insumos_categoria_enum" DEFAULT 'General'::insumos_categoria_enum NOT NULL,
	estado public."insumos_estado_enum" DEFAULT 'Disponible'::insumos_estado_enum NOT NULL,
	fecha_registro timestamp DEFAULT now() NOT NULL,
	fecha_actualizacion timestamp DEFAULT now() NOT NULL,
	fecha_eliminacion timestamp NULL,
	stock_min int4 DEFAULT 0 NOT NULL,
	valor_unitario numeric(10, 2) NOT NULL,
	unidad_medida_id int4 NOT NULL,
	CONSTRAINT insumos_nombre_key UNIQUE (nombre),
	CONSTRAINT insumos_pkey PRIMARY KEY (insumo_id),
	CONSTRAINT "FK_470e197e70d9023189b5ad9e3e8" FOREIGN KEY (unidad_medida_id) REFERENCES unidades_medida(unidad_medida_id)
);

CREATE TABLE inventario (
	inventario_id serial4 NOT NULL,
	insumo_id int4 NULL,
	herramienta_id int4 NULL,
	cantidad_actual numeric(10, 2) DEFAULT 0 NOT NULL,
	ubicacion varchar(200) NULL,
	fecha_ultima_actualizacion timestamp DEFAULT now() NOT NULL,
	fecha_eliminacion timestamp NULL,
	bodega_id int4 NULL,
	CONSTRAINT inventario_herramienta_id_key UNIQUE (herramienta_id),
	CONSTRAINT inventario_pkey PRIMARY KEY (inventario_id),
	CONSTRAINT "FK_45a62e4c84214dae114dd158ab6" FOREIGN KEY (insumo_id) REFERENCES insumos(insumo_id) ON DELETE CASCADE,
	CONSTRAINT "FK_b30b765d04bce72899e4e68286d" FOREIGN KEY (bodega_id) REFERENCES bodegas(bodega_id),
	CONSTRAINT "FK_d1418f8466cf8085328b6e728f0" FOREIGN KEY (herramienta_id) REFERENCES herramientas(herramienta_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX "UQ_INVENTARIO_HERRAMIENTA" ON public.inventario USING btree (herramienta_id) WHERE (herramienta_id IS NOT NULL);
CREATE UNIQUE INDEX "UQ_INVENTARIO_INSUMO_BODEGA" ON public.inventario USING btree (insumo_id, bodega_id) WHERE ((insumo_id IS NOT NULL) AND (bodega_id IS NOT NULL));

CREATE TABLE modulo_roles (
	modulo_id int4 NOT NULL,
	rol_id int4 NOT NULL,
	CONSTRAINT modulo_roles_pkey PRIMARY KEY (modulo_id, rol_id),
	CONSTRAINT "FK_17b65550304addf65ccbe1cb2f4" FOREIGN KEY (modulo_id) REFERENCES modulos(modulo_id) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "FK_7ec20573fae9972dc35b197f067" FOREIGN KEY (rol_id) REFERENCES roles(rol_id)
);
CREATE INDEX "IDX_17b65550304addf65ccbe1cb2f" ON public.modulo_roles USING btree (modulo_id);
CREATE INDEX "IDX_7ec20573fae9972dc35b197f06" ON public.modulo_roles USING btree (rol_id);

CREATE TABLE preoperational_checklist_parameters (
	id serial4 NOT NULL,
	template_id int4 NOT NULL,
	parameter_code varchar NULL,
	"parameter" varchar NOT NULL,
	description text NULL,
	category public."preoperational_checklist_parameters_category_enum" DEFAULT 'safety'::preoperational_checklist_parameters_category_enum NOT NULL,
	required bool DEFAULT false NOT NULL,
	critical bool DEFAULT false NOT NULL,
	"displayOrder" int4 DEFAULT 0 NOT NULL,
	CONSTRAINT "PK_b0513d44536e8ca9cbc3a1325b5" PRIMARY KEY (id),
	CONSTRAINT "FK_2ab5dd52a8a0a3cd81b7df417b8" FOREIGN KEY (template_id) REFERENCES preoperational_checklist_templates(id) ON DELETE CASCADE
);

CREATE TABLE sub_areas (
	id_sub_area serial4 NOT NULL,
	nombre_sub_area varchar(255) NOT NULL,
	area_id int4 NOT NULL,
	parent_sub_area_id int4 NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	updated_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT sub_areas_pkey PRIMARY KEY (id_sub_area),
	CONSTRAINT "FK_1f492fee4187f745f580323c62a" FOREIGN KEY (area_id) REFERENCES areas(id_area),
	CONSTRAINT "FK_8a5d035023bc8126fc0aaddd21a" FOREIGN KEY (parent_sub_area_id) REFERENCES sub_areas(id_sub_area) ON DELETE CASCADE
);

CREATE TABLE usuarios (
	usuario_id serial4 NOT NULL,
	rol_id int4 NOT NULL,
	tipo_cedula public."usuarios_tipo_cedula_enum" DEFAULT 'CC'::usuarios_tipo_cedula_enum NULL,
	cedula varchar(10) NULL,
	nombre varchar(100) NOT NULL,
	apellido varchar(100) NULL,
	email varchar(150) NOT NULL,
	username varchar(50) NOT NULL,
	password_hash varchar(255) NULL,
	telefono varchar(20) NULL,
	activo bool DEFAULT true NOT NULL,
	fecha_creacion timestamp DEFAULT now() NOT NULL,
	fecha_nacimiento date NULL,
	genero public."usuarios_genero_enum" NULL,
	reset_token varchar(255) NULL,
	reset_token_expiry timestamp NULL,
	must_change_password bool DEFAULT false NOT NULL,
	ubicacion_residencia varchar(255) NULL,
	arl varchar(150) NULL,
	eps varchar(150) NULL,
	afp varchar(150) NULL,
	contacto_emergencia_nombre varchar(150) NULL,
	contacto_emergencia_telefono varchar(50) NULL,
	contacto_emergencia_parentesco varchar(100) NULL,
	cargo varchar(100) NULL,
	CONSTRAINT usuarios_email_key UNIQUE (email),
	CONSTRAINT usuarios_pkey PRIMARY KEY (usuario_id),
	CONSTRAINT usuarios_username_key UNIQUE (username),
	CONSTRAINT "FK_9e519760a660751f4fa21453d3e" FOREIGN KEY (rol_id) REFERENCES roles(rol_id)
);

CREATE TABLE clientes_usuarios_contacto (
	id_cliente int4 NOT NULL,
	id_usuario int4 NOT NULL,
	CONSTRAINT clientes_usuarios_contacto_pkey PRIMARY KEY (id_cliente, id_usuario),
	CONSTRAINT "FK_312de62cf3ee9090c5880bdad7d" FOREIGN KEY (id_usuario) REFERENCES usuarios(usuario_id) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "FK_f77fca03a7abb918450df85b2d3" FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "IDX_312de62cf3ee9090c5880bdad7" ON public.clientes_usuarios_contacto USING btree (id_usuario);
CREATE INDEX "IDX_f77fca03a7abb918450df85b2d" ON public.clientes_usuarios_contacto USING btree (id_cliente);

CREATE TABLE equipos (
	equipo_id serial4 NOT NULL,
	cliente_id int4 NOT NULL,
	area_id int4 NULL,
	sub_area_id int4 NULL,
	categoria_equipo public."equipos_categoria_equipo_enum" NOT NULL,
	air_conditioner_type_id int4 NULL,
	codigo_equipo varchar(100) NULL,
	estado_equipo public."equipos_estado_equipo_enum" DEFAULT 'Activo'::equipos_estado_equipo_enum NOT NULL,
	fecha_instalacion date NULL,
	observaciones text NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	updated_at timestamp DEFAULT now() NOT NULL,
	crated_by varchar(150) NULL,
	updated_by varchar(150) NULL,
	plan_mantenimiento_automatico bool DEFAULT false NOT NULL,
	CONSTRAINT equipos_pkey PRIMARY KEY (equipo_id),
	CONSTRAINT "FK_2872439dfcad82f8968945960a5" FOREIGN KEY (cliente_id) REFERENCES clientes(id_cliente),
	CONSTRAINT "FK_62f7880b9abdfd7ea4758b11833" FOREIGN KEY (air_conditioner_type_id) REFERENCES air_conditioner_types(id),
	CONSTRAINT "FK_7839e3ef049376f286a4b38aa4f" FOREIGN KEY (area_id) REFERENCES areas(id_area),
	CONSTRAINT "FK_ef6d56ee2f7f7b2c0481bfa063c" FOREIGN KEY (sub_area_id) REFERENCES sub_areas(id_sub_area)
);

CREATE TABLE notificaciones (
	notificacion_id serial4 NOT NULL,
	usuario_id int4 NOT NULL,
	tipo public."notificaciones_tipo_enum" NOT NULL,
	titulo varchar(150) NOT NULL,
	mensaje text NOT NULL,
	"data" jsonb NULL,
	leida bool DEFAULT false NOT NULL,
	fecha_creacion timestamp DEFAULT now() NOT NULL,
	modulo public."notificaciones_modulo_enum" NULL,
	prioridad public."notificaciones_prioridad_enum" DEFAULT 'medium'::notificaciones_prioridad_enum NOT NULL,
	mensaje_corto varchar(100) NULL,
	accion jsonb NULL,
	fecha_lectura timestamp NULL,
	visible_hasta timestamp NULL,
	CONSTRAINT notificaciones_pkey PRIMARY KEY (notificacion_id),
	CONSTRAINT "FK_2c6341d5bd206ff522b35aa6b69" FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id) ON DELETE CASCADE
);
CREATE INDEX "IDX_2c6341d5bd206ff522b35aa6b6" ON public.notificaciones USING btree (usuario_id);
CREATE INDEX "IDX_306bcbb567a48b9e22223bd224" ON public.notificaciones USING btree (leida);
CREATE INDEX "IDX_37e1a838350e26439c77c750d9" ON public.notificaciones USING btree (usuario_id, fecha_creacion);
CREATE INDEX "IDX_3ca25d75a1f2bbd6d95504b908" ON public.notificaciones USING btree (usuario_id, leida, modulo);
CREATE INDEX "IDX_9f09c057eec443bde829a183d7" ON public.notificaciones USING btree (fecha_creacion);

CREATE TABLE plan_mantenimiento (
	id serial4 NOT NULL,
	fecha_programada date NULL,
	notas text NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	updated_at timestamp DEFAULT now() NOT NULL,
	equipment_id int4 NOT NULL,
	unidad_frecuencia public."plan_mantenimiento_unidad_frecuencia_enum" NULL,
	dia_del_mes int4 NULL,
	CONSTRAINT plan_mantenimiento_equipment_id_key UNIQUE (equipment_id),
	CONSTRAINT plan_mantenimiento_pkey PRIMARY KEY (id),
	CONSTRAINT "FK_6e0d2d96293401fb2c199beab98" FOREIGN KEY (equipment_id) REFERENCES equipos(equipo_id) ON DELETE CASCADE
);

CREATE TABLE user_password_history (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	password_hash varchar(255) NOT NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT user_password_history_pkey PRIMARY KEY (id),
	CONSTRAINT "FK_c273c40bfa9653d6c64f96667c4" FOREIGN KEY (user_id) REFERENCES usuarios(usuario_id) ON DELETE CASCADE
);

CREATE TABLE equipment_condensers (
	id serial4 NOT NULL,
	equipment_id int4 NOT NULL,
	marca varchar(150) NULL,
	modelo varchar(150) NULL,
	serial varchar(150) NULL,
	capacidad varchar(150) NULL,
	amperaje varchar(50) NULL,
	voltaje varchar(50) NULL,
	tipo_refrigerante varchar(100) NULL,
	numero_fases varchar(50) NULL,
	presion_alta varchar(50) NULL,
	presion_baja varchar(50) NULL,
	hp varchar(50) NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	updated_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT equipment_condensers_pkey PRIMARY KEY (id),
	CONSTRAINT "FK_78f35725a73729a196efc0cceb3" FOREIGN KEY (equipment_id) REFERENCES equipos(equipo_id) ON DELETE CASCADE
);

CREATE TABLE equipment_documents (
	id serial4 NOT NULL,
	url varchar NOT NULL,
	public_id varchar NOT NULL,
	folder varchar NULL,
	original_name varchar NULL,
	bytes int4 NULL,
	format varchar NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	equipment_id int4 NULL,
	CONSTRAINT "PK_3509f69e94a1c35abf68fe535d1" PRIMARY KEY (id),
	CONSTRAINT "FK_c1154af788f437b09c3b1c240f8" FOREIGN KEY (equipment_id) REFERENCES equipos(equipo_id) ON DELETE CASCADE
);

CREATE TABLE equipment_evaporators (
	id serial4 NOT NULL,
	equipment_id int4 NOT NULL,
	marca varchar(150) NULL,
	modelo varchar(150) NULL,
	serial varchar(150) NULL,
	capacidad varchar(150) NULL,
	tipo_refrigerante varchar(100) NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	updated_at timestamp DEFAULT now() NOT NULL,
	air_conditioner_type_id int4 NULL,
	CONSTRAINT equipment_evaporators_pkey PRIMARY KEY (id),
	CONSTRAINT "FK_67231dd14f20ee322cd05b49cbe" FOREIGN KEY (equipment_id) REFERENCES equipos(equipo_id) ON DELETE CASCADE,
	CONSTRAINT "FK_d3e51f2d8644416d293c6fa3fc8" FOREIGN KEY (air_conditioner_type_id) REFERENCES air_conditioner_types(id)
);

CREATE TABLE equipment_motors (
	id serial4 NOT NULL,
	amperaje varchar(50) NULL,
	voltaje varchar(50) NULL,
	numero_fases varchar(50) NULL,
	diametro_eje varchar(50) NULL,
	tipo_eje varchar(100) NULL,
	rpm varchar(50) NULL,
	correa varchar(100) NULL,
	diametro_polea varchar(50) NULL,
	capacidad_hp varchar(50) NULL,
	frecuencia varchar(50) NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	updated_at timestamp DEFAULT now() NOT NULL,
	evaporator_id int4 NULL,
	condenser_id int4 NULL,
	numero_parte varchar(50) NULL,
	CONSTRAINT equipment_motors_pkey PRIMARY KEY (id),
	CONSTRAINT "FK_2943f39916029592758f1deda48" FOREIGN KEY (condenser_id) REFERENCES equipment_condensers(id) ON DELETE CASCADE,
	CONSTRAINT "FK_7c1ec0d094d26a6b869e71d4b94" FOREIGN KEY (evaporator_id) REFERENCES equipment_evaporators(id) ON DELETE CASCADE
);

CREATE TABLE ordenes_trabajo (
	orden_id serial4 NOT NULL,
	servicio_id int4 NOT NULL,
	cliente_id int4 NOT NULL,
	cliente_empresa_id int4 NULL,
	fecha_solicitud timestamp DEFAULT now() NOT NULL,
	fecha_inicio timestamp NULL,
	fecha_finalizacion timestamp NULL,
	estado public."ordenes_trabajo_estado_enum" DEFAULT 'Solicitada sin asignar'::ordenes_trabajo_estado_enum NOT NULL,
	estado_facturacion public."ordenes_trabajo_estado_facturacion_enum" NULL,
	factura_pdf_url varchar(500) NULL,
	comentarios text NULL,
	tipo_servicio public."ordenes_trabajo_tipo_servicio_enum" NULL,
	tipo_mantenimiento_id int4 NULL,
	fecha_programada date NULL,
	plan_mantenimiento_id int4 NULL,
	es_emergencia bool DEFAULT false NOT NULL,
	received_by_name varchar(255) NULL,
	received_by_position varchar(255) NULL,
	received_by_signature_data text NULL,
	received_at timestamp NULL,
	estado_pago public."ordenes_trabajo_estado_pago_enum" NULL,
	is_automatic_weekly bool DEFAULT false NOT NULL,
	auto_batch_key varchar(120) NULL,
	auto_week_start date NULL,
	auto_week_end date NULL,
	CONSTRAINT ordenes_trabajo_pkey PRIMARY KEY (orden_id),
	CONSTRAINT "FK_020a4958c0b4f44c462a2c43aec" FOREIGN KEY (cliente_id) REFERENCES usuarios(usuario_id),
	CONSTRAINT "FK_1b1f4f797fce498c066680b4818" FOREIGN KEY (tipo_mantenimiento_id) REFERENCES tipos_mantenimiento(tipo_mantenimiento_id),
	CONSTRAINT "FK_3cc126460bc333638d9b0512d59" FOREIGN KEY (cliente_empresa_id) REFERENCES clientes(id_cliente),
	CONSTRAINT "FK_a4305f31bf6afbb60666df5af52" FOREIGN KEY (plan_mantenimiento_id) REFERENCES plan_mantenimiento(id),
	CONSTRAINT "FK_b51beb5bd6570b4169c1c356b4b" FOREIGN KEY (servicio_id) REFERENCES servicios(servicio_id)
);
CREATE UNIQUE INDEX uq_ordenes_trabajo_auto_batch_key ON public.ordenes_trabajo USING btree (auto_batch_key);

CREATE TABLE ordenes_trabajo_pausas (
	pause_id serial4 NOT NULL,
	orden_id int4 NOT NULL,
	inicio timestamp NOT NULL,
	fin timestamp NULL,
	usuario_id int4 NOT NULL,
	observacion text NULL,
	CONSTRAINT "PK_a827553fd7796c191686377c60d" PRIMARY KEY (pause_id),
	CONSTRAINT "FK_2de52852af3191b5eb7287453ee" FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(orden_id),
	CONSTRAINT "FK_56909e9132b874ce676641c5d16" FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
);

CREATE TABLE ordenes_trabajo_planes (
	id serial4 NOT NULL,
	orden_id int4 NOT NULL,
	plan_id int4 NOT NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "PK_6aa8059f5028abb32855eeb4660" PRIMARY KEY (id),
	CONSTRAINT "FK_115f76e200eb2fd2b135ea0223a" FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(orden_id) ON DELETE CASCADE,
	CONSTRAINT "FK_43273c22a577613a1f6c46635c3" FOREIGN KEY (plan_id) REFERENCES plan_mantenimiento(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX "IDX_9d9220879d233d215d6514bd68" ON public.ordenes_trabajo_planes USING btree (orden_id, plan_id);

CREATE TABLE ordenes_trabajo_tecnicos (
	id serial4 NOT NULL,
	orden_id int4 NOT NULL,
	tecnico_id int4 NOT NULL,
	es_lider bool DEFAULT false NOT NULL,
	calificacion numeric(2, 1) NULL,
	calificado_por int4 NULL,
	fecha_calificacion timestamp NULL,
	CONSTRAINT "PK_8d08dd9c42e3d6d9a3c5f656d6b" PRIMARY KEY (id),
	CONSTRAINT "FK_404c5d6feb403d6278f6974a664" FOREIGN KEY (tecnico_id) REFERENCES usuarios(usuario_id),
	CONSTRAINT "FK_7718a6962842387b513710edbea" FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(orden_id)
);

CREATE TABLE ordenes_trabajo_timer (
	timer_id serial4 NOT NULL,
	orden_id int4 NOT NULL,
	inicio timestamp NOT NULL,
	fin timestamp NULL,
	total_segundos int4 DEFAULT 0 NOT NULL,
	CONSTRAINT "PK_b535992724a7ce2c35cb02d29a2" PRIMARY KEY (timer_id),
	CONSTRAINT "FK_69cfb496234f4bf8aa29c2751ac" FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(orden_id)
);

CREATE TABLE ac_inspections (
	id serial4 NOT NULL,
	work_order_id int4 NOT NULL,
	equipment_id int4 NULL,
	phase public."ac_inspections_phase_enum" NOT NULL,
	evap_temp_supply float8 NOT NULL,
	evap_temp_return float8 NOT NULL,
	evap_temp_ambient float8 NOT NULL,
	evap_temp_outdoor float8 NOT NULL,
	evap_motor_rpm float8 NOT NULL,
	evap_microfarads float8 NULL,
	cond_high_pressure float8 NOT NULL,
	cond_low_pressure float8 NOT NULL,
	cond_amperage float8 NOT NULL,
	cond_voltage float8 NOT NULL,
	cond_temp_in float8 NOT NULL,
	cond_temp_discharge float8 NOT NULL,
	cond_motor_rpm float8 NOT NULL,
	cond_microfarads float8 NULL,
	compressor_onion float8 NULL,
	observation text NULL,
	created_by_user_id int4 NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "PK_328064042f4ce50befa44747096" PRIMARY KEY (id),
	CONSTRAINT "FK_33707886f6b30ba3891e75a67bb" FOREIGN KEY (work_order_id) REFERENCES ordenes_trabajo(orden_id) ON DELETE CASCADE,
	CONSTRAINT "FK_ba6bd1771f3e1da02aa1b554fc3" FOREIGN KEY (equipment_id) REFERENCES equipos(equipo_id),
	CONSTRAINT "FK_cdd52812e0378f3b846314c305d" FOREIGN KEY (created_by_user_id) REFERENCES usuarios(usuario_id)
);

CREATE TABLE detalles_herramienta_asignado (
	detalle_herramienta_id serial4 NOT NULL,
	orden_id int4 NOT NULL,
	herramienta_id int4 NOT NULL,
	tiempo_uso varchar(50) NULL,
	comentarios_uso varchar NULL,
	CONSTRAINT detalles_herramienta_asignado_pkey PRIMARY KEY (detalle_herramienta_id),
	CONSTRAINT "FK_700846ad5a57fbb665d45bda256" FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(orden_id),
	CONSTRAINT "FK_b6ad0c46552733dd944f2ff38f8" FOREIGN KEY (herramienta_id) REFERENCES herramientas(herramienta_id)
);

CREATE TABLE detalles_insumo_usado (
	detalle_insumo_id serial4 NOT NULL,
	orden_id int4 NOT NULL,
	insumo_id int4 NOT NULL,
	cantidad_usada numeric(10, 2) NOT NULL,
	costo_unitario_al_momento numeric(10, 2) NULL,
	CONSTRAINT detalles_insumo_usado_pkey PRIMARY KEY (detalle_insumo_id),
	CONSTRAINT "FK_416939a9dc170212ac785182645" FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(orden_id),
	CONSTRAINT "FK_594d514c7b82ee21e39586139c3" FOREIGN KEY (insumo_id) REFERENCES insumos(insumo_id)
);

CREATE TABLE equipment_compressors (
	id serial4 NOT NULL,
	condenser_id int4 NOT NULL,
	marca varchar(150) NULL,
	modelo varchar(150) NULL,
	serial varchar(150) NULL,
	capacidad varchar(150) NULL,
	voltaje varchar(50) NULL,
	frecuencia varchar(50) NULL,
	tipo_refrigerante varchar(100) NULL,
	tipo_aceite varchar(50) NULL,
	cantidad_aceite varchar(50) NULL,
	capacitor varchar(100) NULL,
	lra varchar(50) NULL,
	fla varchar(50) NULL,
	cantidad_polos varchar(50) NULL,
	amperaje varchar(50) NULL,
	voltaje_bobina varchar(50) NULL,
	vac varchar(50) NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	updated_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT equipment_compressors_pkey PRIMARY KEY (id),
	CONSTRAINT "FK_f03a2794c6875efdd71259cae62" FOREIGN KEY (condenser_id) REFERENCES equipment_condensers(id) ON DELETE CASCADE
);

CREATE TABLE equipment_work_order (
	id serial4 NOT NULL,
	equipment_id int4 NOT NULL,
	work_order_id int4 NOT NULL,
	description text NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UQ_73c6d6c36f290ee89c7e3f96aa6" UNIQUE (equipment_id, work_order_id),
	CONSTRAINT equipment_work_order_pkey PRIMARY KEY (id),
	CONSTRAINT "FK_57e85d16e7656a3fbae61443dd1" FOREIGN KEY (equipment_id) REFERENCES equipos(equipo_id) ON DELETE CASCADE,
	CONSTRAINT "FK_eaaf43206b7fb34efe0018fde39" FOREIGN KEY (work_order_id) REFERENCES ordenes_trabajo(orden_id) ON DELETE CASCADE
);

CREATE TABLE forms (
	id serial4 NOT NULL,
	"formType" public."forms_formtype_enum" DEFAULT 'PREOPERATIONAL'::forms_formtype_enum NOT NULL,
	status public."forms_status_enum" DEFAULT 'DRAFT'::forms_status_enum NOT NULL,
	"equipmentTool" varchar NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"technicianSignatureDate" timestamp NULL,
	"sstSignatureDate" timestamp NULL,
	"userId" int4 NOT NULL,
	"createdBy" int4 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	work_order_id int4 NULL,
	"rejectionReason" varchar NULL,
	"rejectedByUserId" int4 NULL,
	"rejectedByUserName" varchar NULL,
	"rejectedAt" timestamp NULL,
	"pdfFilePath" varchar NULL,
	"pdfFileName" varchar NULL,
	"pdfFileSize" int4 NULL,
	"pdfHash" varchar NULL,
	"pdfGeneratedAt" timestamp NULL,
	CONSTRAINT forms_pkey PRIMARY KEY (id),
	CONSTRAINT "FK_08f0ffcce17394ec4aafcbed2f9" FOREIGN KEY ("userId") REFERENCES usuarios(usuario_id),
	CONSTRAINT "FK_3a7ec0a1f162856d700885d7d13" FOREIGN KEY (work_order_id) REFERENCES ordenes_trabajo(orden_id)
);

CREATE TABLE generated_pdfs (
	id serial4 NOT NULL,
	"formId" int4 NOT NULL,
	"pdfData" bytea NULL,
	"fileName" varchar NOT NULL,
	"filePath" varchar NULL,
	"fileSize" int4 NOT NULL,
	"generatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT generated_pdfs_pkey PRIMARY KEY (id),
	CONSTRAINT "FK_e47a6278e31551c130fc9466e4a" FOREIGN KEY ("formId") REFERENCES forms(id)
);

CREATE TABLE height_works (
	id serial4 NOT NULL,
	"formId" int4 NOT NULL,
	"workerName" varchar NOT NULL,
	identification varchar NULL,
	"position" varchar NULL,
	"workDescription" text NULL,
	"location" text NULL,
	"estimatedTime" varchar NULL,
	"protectionElements" jsonb NULL,
	"physicalCondition" bool NULL,
	"instructionsReceived" bool NULL,
	"fitForHeightWork" bool NULL,
	"authorizerName" varchar NULL,
	"authorizerIdentification" varchar NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "height_works_formId_key" UNIQUE ("formId"),
	CONSTRAINT height_works_pkey PRIMARY KEY (id),
	CONSTRAINT "FK_50d8d5de5fabc1fffb8343331c8" FOREIGN KEY ("formId") REFERENCES forms(id)
);

CREATE TABLE images (
	id serial4 NOT NULL,
	url varchar NOT NULL,
	public_id varchar NOT NULL,
	folder varchar NOT NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	is_logo bool DEFAULT false NOT NULL,
	tool_id int4 NULL,
	supply_id int4 NULL,
	user_id int4 NULL,
	equipment_id int4 NULL,
	client_id int4 NULL,
	work_order_id int4 NULL,
	evidence_phase public."images_evidence_phase_enum" NULL,
	observation text NULL,
	CONSTRAINT images_pkey PRIMARY KEY (id),
	CONSTRAINT "FK_31875036883b451983e94eff9e0" FOREIGN KEY (supply_id) REFERENCES insumos(insumo_id) ON DELETE CASCADE,
	CONSTRAINT "FK_59897b00d165dc1a32c84edf1b0" FOREIGN KEY (tool_id) REFERENCES herramientas(herramienta_id) ON DELETE CASCADE,
	CONSTRAINT "FK_5e192297b3f1ab100fe5d763895" FOREIGN KEY (work_order_id) REFERENCES ordenes_trabajo(orden_id) ON DELETE CASCADE,
	CONSTRAINT "FK_906d8dcaacc8c2a17369575be42" FOREIGN KEY (equipment_id) REFERENCES equipos(equipo_id) ON DELETE CASCADE,
	CONSTRAINT "FK_decdf86f650fb765dac7bd091a6" FOREIGN KEY (user_id) REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
	CONSTRAINT "FK_f9edc7afd1d93170ec8486eb4f6" FOREIGN KEY (client_id) REFERENCES clientes(id_cliente) ON DELETE CASCADE
);

CREATE TABLE preoperational_checks (
	id serial4 NOT NULL,
	"formId" int4 NOT NULL,
	"parameter" varchar NOT NULL,
	value public."preoperational_checks_value_enum" NULL,
	observations text NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT preoperational_checks_pkey PRIMARY KEY (id),
	CONSTRAINT "FK_7453bbe13afd9034995df277982" FOREIGN KEY ("formId") REFERENCES forms(id)
);

CREATE TABLE sign_otps (
	id serial4 NOT NULL,
	"userId" int4 NOT NULL,
	"formId" int4 NOT NULL,
	"signatureType" public."sign_otps_signaturetype_enum" NOT NULL,
	"codeHash" varchar NOT NULL,
	channel varchar DEFAULT 'EMAIL'::character varying NOT NULL,
	attempts int4 DEFAULT 0 NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "PK_6e20eac07667de2ee034ec94298" PRIMARY KEY (id),
	CONSTRAINT "FK_70cb9d71c4c22c2ff014994e11e" FOREIGN KEY ("formId") REFERENCES forms(id)
);

CREATE TABLE signatures (
	id serial4 NOT NULL,
	"formId" int4 NOT NULL,
	"signatureType" public."signatures_signaturetype_enum" NOT NULL,
	"userId" int4 NOT NULL,
	"userName" varchar NOT NULL,
	"signatureData" text NULL,
	"signedAt" timestamp DEFAULT now() NOT NULL,
	ip varchar NULL,
	"userAgent" varchar NULL,
	"method" varchar NULL,
	"contactSnapshot" varchar NULL,
	CONSTRAINT signatures_pkey PRIMARY KEY (id),
	CONSTRAINT "FK_3c088f8c7ffa372b77b0c6586e0" FOREIGN KEY ("formId") REFERENCES forms(id)
);

CREATE TABLE ats_reports (
	id serial4 NOT NULL,
	"formId" int4 NOT NULL,
	client_id int4 NULL,
	"workerName" varchar NOT NULL,
	"position" varchar NULL,
	area varchar NULL,
	"workToPerform" text NULL,
	"location" varchar NULL,
	"startTime" time NULL,
	"endTime" time NULL,
	"date" date NULL,
	observations text NULL,
	"selectedRisks" jsonb NULL,
	"requiredPpe" jsonb NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	client_name varchar NULL,
	client_nit varchar NULL,
	worker_identification varchar NULL,
	sub_area varchar NULL,
	CONSTRAINT "ats_reports_formId_key" UNIQUE ("formId"),
	CONSTRAINT ats_reports_pkey PRIMARY KEY (id),
	CONSTRAINT "FK_a48f9c82e8b624448341b8775e9" FOREIGN KEY ("formId") REFERENCES forms(id),
	CONSTRAINT "FK_da14c52c1395025af4cfad47ebd" FOREIGN KEY (client_id) REFERENCES clientes(id_cliente)
);
    `;

    await queryRunner.query(sql);
  }

  public async down(): Promise<void> {
    throw new Error('Down no soportado para InitialSchema');
  }
}
