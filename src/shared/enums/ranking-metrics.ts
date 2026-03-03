// src/shared/ranking-metrics.ts
export const RANKING_METRICS = {
  // Peso de cada factor en el ranking (suma = 100%)
  WEIGHTS: {
    CALIFICACION_PROMEDIO: 0.60, // 60% - Calificación promedio del mes
    ORDENES_COMPLETADAS: 0.25,    // 25% - Cantidad de órdenes completadas
    PUNTUALIDAD: 0.15,            // 15% - Cumplimiento de tiempos
  },
  
  // Factores de ajuste
  MIN_ORDENES_REQUERIDAS: 3,       // Mínimo de órdenes para aparecer en ranking
  BONUS_LIDERAZGO: 0.5,            // Puntos extra por ser líder en órdenes complejas
};