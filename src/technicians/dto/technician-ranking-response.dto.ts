// src/technicians/dto/technician-ranking-response.dto.ts
export class TechnicianRankingResponseDto {
  tecnicoId: number;
  nombre: string;
  apellido: string;
  avatar?: string;

  // Métricas desglosadas
  metrics: {
    calificacionPromedio: number; // 0-5
    totalOrdenes: number; // Cantidad
    puntualidad: number; // 0-5
    vecesLider: number; // Cantidad
  };

  // Puntaje compuesto final
  puntajeTotal: number; // 0-10

  // Posición
  puesto: number;

  // Para mostrar tendencia en UI
  tendencia: 'up' | 'down' | 'stable';
  variacionPuesto: number;

  // Badges/Logros
  badges?: {
    excelente: boolean; // Calificación > 4.5
    productivo: boolean; // > 15 órdenes en el mes
    lider: boolean; // Fue líder en > 5 órdenes
    puntual: boolean; // Puntualidad > 4.5
  };
}
