import * as ExcelJS from 'exceljs';
import { Equipment } from '../../src/equipment/entities/equipment.entity';
import { UnidadFrecuencia } from '../../src/shared';
import { PlanMantenimiento } from '../../src/equipment/entities/plan-mantenimiento.entity';

interface AnnualMaintenanceTemplateInput {
  year: number;
  equipments: Equipment[]; // con planMantenimiento, evaporators, area, subArea cargados
}

// ───────────── Helpers de fechas (copiados de tu servicio) ─────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);

  // Ajuste por meses cortos
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

function nextPlanDate(
  current: Date,
  unidad: UnidadFrecuencia,
  step: number,
): Date {
  if (!step || step <= 0) {
    step = 1; // Valor por defecto
  }

  switch (unidad) {
    case UnidadFrecuencia.DIA:
      return addDays(current, step);
    case UnidadFrecuencia.SEMANA:
      return addDays(current, step * 7);
    case UnidadFrecuencia.MES:
      return addMonths(current, step);
    default:
      return current;
  }
}

function adjustToWorkingDay(date: Date): Date {
  const d = startOfDay(date);
  // 0 = Domingo
  if (d.getDay() === 0) {
    return addDays(d, 1); // Pasar al lunes
  }
  return d;
}

function generateMaintenanceDatesForYear(
  plan: PlanMantenimiento,
  year: number,
): Date[] {
  if (!plan || !plan.fechaProgramada || !plan.unidadFrecuencia) {
    return [];
  }

  const dates: Date[] = [];
  const unidad = plan.unidadFrecuencia;
  const step = plan.diaDelMes ?? 1;

  let current = startOfDay(new Date(plan.fechaProgramada));

  while (current.getFullYear() < year) {
    current = nextPlanDate(current, unidad, step);
  }

  while (current.getFullYear() === year) {
    dates.push(adjustToWorkingDay(current));
    current = nextPlanDate(current, unidad, step);
  }

  return dates;
}

// ───────────── Helper de ubicación ─────────────

function getCurrentLocation(equipment: Equipment): string {
  if (equipment.subArea) {
    return equipment.subArea.nombreSubArea;
  }
  if (equipment.area) {
    return equipment.area.nombreArea;
  }
  return 'Sin ubicación';
}

// ───────────── Template principal ─────────────

export async function buildAnnualMaintenancePlanExcel(
  input: AnnualMaintenanceTemplateInput,
): Promise<Buffer> {
  const { year, equipments } = input;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Plan ${year}`);

  const MONTHS = [
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE',
  ];

  const WEEKS_PER_MONTH = 4; // 4 semanas fijas
  const DAYS_PER_WEEK = 6; // 6 días (lunes–sábado)

  // Columnas fijas
  const COL_UBICACION = 1; // Nueva: última subárea/área
  const COL_EQUIPO = 2; // Código del equipo
  const COL_MOD = 3; // Modelo
  const COL_SERIAL = 4; // Serial
  const FIRST_PLAN_COL = 5; // Las columnas del plan empiezan aquí

  // Cabecera básica
  sheet.mergeCells(1, COL_UBICACION, 3, COL_UBICACION);
  sheet.getCell(1, COL_UBICACION).value = 'UBICACIÓN';
  sheet.getColumn(COL_UBICACION).width = 25;

  sheet.mergeCells(1, COL_EQUIPO, 3, COL_EQUIPO);
  sheet.getCell(1, COL_EQUIPO).value = 'EQUIPO';
  sheet.getColumn(COL_EQUIPO).width = 15;

  sheet.mergeCells(1, COL_MOD, 3, COL_MOD);
  sheet.getCell(1, COL_MOD).value = 'MOD';
  sheet.getColumn(COL_MOD).width = 15;

  sheet.mergeCells(1, COL_SERIAL, 3, COL_SERIAL);
  sheet.getCell(1, COL_SERIAL).value = 'SERIAL';
  sheet.getColumn(COL_SERIAL).width = 18;

  // Meses / semanas / días
  MONTHS.forEach((monthName, monthIndex) => {
    const monthStartCol =
      FIRST_PLAN_COL + monthIndex * (WEEKS_PER_MONTH * DAYS_PER_WEEK);
    const monthEndCol = monthStartCol + WEEKS_PER_MONTH * DAYS_PER_WEEK - 1;

    // Fila 1: mes
    sheet.mergeCells(1, monthStartCol, 1, monthEndCol);
    const monthCell = sheet.getCell(1, monthStartCol);
    monthCell.value = monthName;
    monthCell.alignment = { horizontal: 'center', vertical: 'middle' };
    monthCell.font = { bold: true };

    // Fila 2: semanas
    for (let w = 0; w < WEEKS_PER_MONTH; w++) {
      const weekStart = monthStartCol + w * DAYS_PER_WEEK;
      const weekEnd = weekStart + DAYS_PER_WEEK - 1;
      sheet.mergeCells(2, weekStart, 2, weekEnd);
      const weekCell = sheet.getCell(2, weekStart);
      weekCell.value = `SEMANA ${w + 1}`;
      weekCell.alignment = { horizontal: 'center', vertical: 'middle' };
      weekCell.font = { bold: true };
    }

    // Fila 3: columnas de día (1..6 → Lunes..Sábado)
    for (let w = 0; w < WEEKS_PER_MONTH; w++) {
      const weekStart = monthStartCol + w * DAYS_PER_WEEK;
      for (let d = 0; d < DAYS_PER_WEEK; d++) {
        const col = weekStart + d;
        const dayCell = sheet.getCell(3, col);
        dayCell.value = d + 1; // en tu plantilla se ven 1..6
        dayCell.alignment = { horizontal: 'center', vertical: 'middle' };
        dayCell.font = { size: 8 };
      }
    }
  });

  // Ajustar ancho de TODAS las columnas del plan a 3
  const totalPlanCols = MONTHS.length * WEEKS_PER_MONTH * DAYS_PER_WEEK;
  for (let col = FIRST_PLAN_COL; col < FIRST_PLAN_COL + totalPlanCols; col++) {
    sheet.getColumn(col).width = 3;
  }

  // Bordes cabecera
  for (let row = 1; row <= 3; row++) {
    const r = sheet.getRow(row);
    r.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
    });
  }

  // Vista congelada: primeras 3 filas y 4 columnas
  sheet.views = [{ state: 'frozen', xSplit: 4, ySplit: 3 }];

  // Filas de equipos
  let currentRowIndex = 4;

  for (const eq of equipments) {
    const row = sheet.getRow(currentRowIndex);

    // UBICACIÓN
    const location = getCurrentLocation(eq);
    row.getCell(COL_UBICACION).value = location;

    // EQUIPO (código interno o ID)
    row.getCell(COL_EQUIPO).value = eq.code ?? eq.equipmentId;

    // MOD / SERIAL desde la primera evaporadora
    const firstEvap = eq.evaporators && eq.evaporators[0];
    row.getCell(COL_MOD).value = firstEvap?.modelo ?? 'N/A';
    row.getCell(COL_SERIAL).value = firstEvap?.serial ?? 'N/A';

    // Fechas de mantenimiento en ese año
    const plan = eq.planMantenimiento as PlanMantenimiento | null;
    const dates = plan ? generateMaintenanceDatesForYear(plan, year) : [];

    for (const date of dates) {
      const monthIndex = date.getMonth(); // 0..11
      const dayOfMonth = date.getDate(); // 1..31

      // Semana del mes (0..3; 4ª semana agrupa lo que sobre)
      let weekIndex = Math.floor((dayOfMonth - 1) / 7);
      if (weekIndex >= WEEKS_PER_MONTH) {
        weekIndex = WEEKS_PER_MONTH - 1;
      }

      const jsDay = date.getDay(); // 0 Domingo .. 6 Sábado
      // Lunes(0)..Domingo(6) => ((0+6)%7 = 6) => Domingo=6, Lunes=0
      let dayOfWeekIndex = (jsDay + 6) % 7;

      // Saltar domingos (índice 6)
      if (dayOfWeekIndex >= DAYS_PER_WEEK) {
        continue;
      }

      const monthStartCol =
        FIRST_PLAN_COL + monthIndex * (WEEKS_PER_MONTH * DAYS_PER_WEEK);
      const weekStartCol = monthStartCol + weekIndex * DAYS_PER_WEEK;
      const col = weekStartCol + dayOfWeekIndex;

      const cell = row.getCell(col);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00B0F0' }, // azul
      };
    }

    // Bordes de la fila
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    currentRowIndex++;
  }

  const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  return buffer;
}
