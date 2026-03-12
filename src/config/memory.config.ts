// src/config/memory.config.ts
export interface MemoryConfig {
  limits: {
    websocketMaxPayload: number; // bytes
    defaultQueryLimit: number; // registros
    maxQueryLimit: number; // registros
    maxFileBuffer: number; // bytes
    queryTimeout: number; // ms
  };
  pagination: {
    defaultPageSize: number;
    maxPageSize: number;
  };
  cache: {
    ttl: number; // ms
    maxSize: number; // número de items
  };
  alerts: {
    memoryThreshold: number; // porcentaje
    heapThreshold: number; // porcentaje
    checkInterval: number; // ms
  };
}

export const memoryConfig: MemoryConfig = {
  limits: {
    websocketMaxPayload: 500 * 1024, // 500KB
    defaultQueryLimit: 50, // 50 registros
    maxQueryLimit: 200, // 200 registros máximo
    maxFileBuffer: 10 * 1024 * 1024, // 10MB
    queryTimeout: 30000, // 30 segundos
  },
  pagination: {
    defaultPageSize: 50,
    maxPageSize: 200,
  },
  cache: {
    ttl: 5 * 60 * 1000, // 5 minutos
    maxSize: 100, // 100 items en caché
  },
  alerts: {
    memoryThreshold: 0.8, // 80% de uso
    heapThreshold: 0.7, // 70% del heap
    checkInterval: 30000, // cada 30 segundos
  },
};
