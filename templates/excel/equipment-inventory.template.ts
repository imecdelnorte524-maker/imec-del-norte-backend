import * as ExcelJS from 'exceljs';
import { Equipment } from '../../src/equipment/entities/equipment.entity';
import { AirConditionerType } from '../../src/air-conditioner-types/entities/air-conditioner-type.entity';

interface EquipmentInventoryTemplateInput {
  equipments: Equipment[];
}

const getLocation = (eq: Equipment): string => {
  if (eq.subArea) return eq.subArea.nombreSubArea;
  if (eq.area) return eq.area.nombreArea;
  return 'Sin ubicación';
};

const isMultiSystem = (acType?: AirConditionerType | null): boolean => {
  if (!acType?.name) return false;
  const name = acType.name.toLowerCase();
  return (
    name.includes('multi') ||
    name.includes('variable') ||
    name.includes('vrf') ||
    name.includes('vrv') ||
    /\bvr\b/.test(name)
  );
};

export async function buildEquipmentInventoryExcel(
  input: EquipmentInventoryTemplateInput,
): Promise<Buffer> {
  const { equipments } = input;

  const workbook = new ExcelJS.Workbook();

  // ───────────── Hoja 1: Equipos ─────────────
  const sheetEquipos = workbook.addWorksheet('Equipos');

  sheetEquipos.columns = [
    { header: 'CÓDIGO', key: 'codigo', width: 18 },
    { header: 'UBICACIÓN', key: 'ubicacion', width: 25 },
    { header: 'TIPO AIRE GENERAL', key: 'tipoAire', width: 25 },
    { header: '# EVAPORADORAS', key: 'numEvap', width: 18 },
    { header: '# CONDENSADORAS', key: 'numCond', width: 18 },

    { header: 'EVAP MARCA', key: 'evapMarca', width: 18 },
    { header: 'EVAP MODELO', key: 'evapModelo', width: 18 },
    { header: 'EVAP SERIAL', key: 'evapSerial', width: 20 },
    { header: 'EVAP CAPACIDAD', key: 'evapCapacidad', width: 18 },

    { header: 'COND MARCA', key: 'condMarca', width: 18 },
    { header: 'COND MODELO', key: 'condModelo', width: 18 },
    { header: 'COND SERIAL', key: 'condSerial', width: 20 },
    { header: 'COND CAPACIDAD', key: 'condCapacidad', width: 18 },
  ];

  equipments.forEach((eq) => {
    const ubicacion = getLocation(eq);
    const tipoGeneral = eq.airConditionerType?.name ?? '';
    const numEvap = eq.evaporators?.length ?? 0;
    const numCond = eq.condensers?.length ?? 0;

    const multi = isMultiSystem(eq.airConditionerType);

    // Para equipos normales (1 a 1) mostramos detalle de 1ra evap/cond
    const firstEvap = !multi && numEvap > 0 ? eq.evaporators?.[0] : undefined;
    const firstCond =
      !multi && numCond > 0 ? (eq.condensers?.[0] as any) : undefined;

    sheetEquipos.addRow({
      codigo: eq.code,
      ubicacion,
      tipoAire: tipoGeneral,
      numEvap,
      numCond,

      evapMarca: firstEvap?.marca ?? '',
      evapModelo: firstEvap?.modelo ?? '',
      evapSerial: firstEvap?.serial ?? '',
      evapCapacidad: firstEvap?.capacidad ?? '',

      condMarca: firstCond?.marca ?? '',
      condModelo: firstCond?.modelo ?? '',
      condSerial: firstCond?.serial ?? '',
      condCapacidad: firstCond?.capacidad ?? '',
    });
  });

  sheetEquipos.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // ───────────── Hoja 2: Evaporadoras ─────────────
  const sheetEvap = workbook.addWorksheet('Evaporadoras');

  sheetEvap.columns = [
    { header: 'CÓDIGO EQUIPO', key: 'codigoEquipo', width: 18 },
    { header: 'UBICACIÓN', key: 'ubicacion', width: 25 },
    { header: 'TIPO AIRE GENERAL', key: 'tipoAireGeneral', width: 25 },
    { header: 'TIPO AIRE EVAP.', key: 'tipoAireEvap', width: 25 },
    { header: 'MARCA', key: 'marca', width: 18 },
    { header: 'MODELO', key: 'modelo', width: 18 },
    { header: 'SERIAL', key: 'serial', width: 20 },
    { header: 'CAPACIDAD', key: 'capacidad', width: 18 },
    { header: 'REFRIGERANTE', key: 'refrigerante', width: 18 },
  ];

  for (const eq of equipments) {
    const ubicacion = getLocation(eq);
    const tipoGeneral = eq.airConditionerType?.name ?? '';
    const multi = isMultiSystem(eq.airConditionerType);

    for (const evap of eq.evaporators ?? []) {
      sheetEvap.addRow({
        codigoEquipo: eq.code,
        ubicacion,
        tipoAireGeneral: tipoGeneral,
        tipoAireEvap: multi ? evap.airConditionerTypeEvap?.name ?? '' : '',
        marca: evap.marca ?? '',
        modelo: evap.modelo ?? '',
        serial: evap.serial ?? '',
        capacidad: evap.capacidad ?? '',
        refrigerante: evap.tipoRefrigerante ?? '',
      });
    }
  }

  sheetEvap.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // ───────────── Hoja 3: Condensadoras ─────────────
  const sheetCond = workbook.addWorksheet('Condensadoras');

  sheetCond.columns = [
    { header: 'CÓDIGO EQUIPO', key: 'codigoEquipo', width: 18 },
    { header: 'UBICACIÓN', key: 'ubicacion', width: 25 },
    { header: 'TIPO AIRE GENERAL', key: 'tipoAireGeneral', width: 25 },
    { header: 'MARCA', key: 'marca', width: 18 },
    { header: 'MODELO', key: 'modelo', width: 18 },
    { header: 'SERIAL', key: 'serial', width: 20 },
    { header: 'CAPACIDAD', key: 'capacidad', width: 18 },
    { header: 'REFRIGERANTE', key: 'refrigerante', width: 18 },
  ];

  for (const eq of equipments) {
    const ubicacion = getLocation(eq);
    const tipoGeneral = eq.airConditionerType?.name ?? '';

    for (const cond of eq.condensers ?? []) {
      const c: any = cond;
      sheetCond.addRow({
        codigoEquipo: eq.code,
        ubicacion,
        tipoAireGeneral: tipoGeneral,
        marca: c.marca ?? '',
        modelo: c.modelo ?? '',
        serial: c.serial ?? '',
        capacidad: c.capacidad ?? '',
        refrigerante: c.tipoRefrigerante ?? '',
      });
    }
  }

  sheetCond.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  return buffer;
}