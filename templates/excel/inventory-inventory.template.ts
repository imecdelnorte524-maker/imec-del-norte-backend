// src/templates/excel/inventory-inventory.template.ts
import * as ExcelJS from 'exceljs';
import { Inventory } from '../../src/inventory/entities/inventory.entity';

interface InventoryExcelInput {
  inventories: Inventory[];
  title?: string;
}

export async function buildInventoryExcel(
  input: InventoryExcelInput,
): Promise<Buffer> {
  const { inventories, title = 'Inventario' } = input;

  const workbook = new ExcelJS.Workbook();

  // Separar inventarios por tipo
  const insumos = inventories.filter((inv) => inv.insumoId && inv.supply);
  const herramientas = inventories.filter(
    (inv) => inv.herramientaId && inv.tool && inv.tool.tipo === 'Herramienta',
  );
  const equipos = inventories.filter(
    (inv) => inv.herramientaId && inv.tool && inv.tool.tipo === 'Equipo',
  );

  // ===== HOJA DE INSUMOS =====
  if (insumos.length > 0) {
    const sheet = workbook.addWorksheet('INSUMOS');

    sheet.columns = [
      { header: 'CÓDIGO', key: 'codigo', width: 15 },
      { header: 'NOMBRE', key: 'nombre', width: 30 },
      { header: 'CATEGORÍA', key: 'categoria', width: 20 },
      { header: 'UNIDAD', key: 'unidad', width: 12 },
      { header: 'CANTIDAD', key: 'cantidad', width: 12 },
      { header: 'STOCK MÍN.', key: 'stockMin', width: 12 },
      { header: 'ESTADO', key: 'estado', width: 16 },
      { header: 'VALOR UNIT.', key: 'valorUnitario', width: 14 },
      { header: 'VALOR TOTAL', key: 'valorTotal', width: 14 },
      { header: 'BODEGA', key: 'bodega', width: 22 },
      { header: 'CLIENTE', key: 'cliente', width: 22 },
      { header: 'UBICACIÓN', key: 'ubicacion', width: 30 },
      { header: 'F. ACTUALIZACIÓN', key: 'fecha', width: 22 },
    ];

    // Estilo encabezado
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4472C4' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    for (const inv of insumos) {
      const cantidad = Number(inv.cantidadActual ?? 0);
      const valorUnitario = Number(inv.valorUnitario ?? 0);
      const valorTotal = cantidad * valorUnitario;

      sheet.addRow({
        nombre: inv.supply?.nombre || '',
        categoria: inv.supply?.categoria || '',
        unidad: inv.supply?.unidadMedida?.nombre || '',
        cantidad,
        stockMin: inv.supply?.stockMin ?? 0,
        estado: inv.estadoInventario || inv.supply?.estado || 'N/A',
        valorUnitario,
        valorTotal,
        bodega: inv.bodega?.nombre || 'SIN BODEGA',
        cliente: inv.bodega?.cliente?.nombre || '',
        ubicacion: inv.ubicacion || '',
        fecha:
          inv.fechaUltimaActualizacion instanceof Date
            ? inv.fechaUltimaActualizacion
            : inv.fechaUltimaActualizacion
              ? new Date(inv.fechaUltimaActualizacion as any)
              : null,
      });
    }

    // Formato numérico
    ['valorUnitario', 'valorTotal', 'cantidad', 'stockMin'].forEach((key) => {
      const col = sheet.getColumn(key);
      col.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
        if (rowNumber > 1) {
          if (key === 'valorUnitario' || key === 'valorTotal') {
            cell.numFmt = '"$"#,##0.00';
            cell.alignment = { horizontal: 'right' };
          } else {
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'right' };
          }
        }
      });
    });
  }

  // ===== HOJA DE HERRAMIENTAS =====
  if (herramientas.length > 0) {
    const sheet = workbook.addWorksheet('HERRAMIENTAS');

    sheet.columns = [
      { header: 'CÓDIGO', key: 'codigo', width: 15 },
      { header: 'NOMBRE', key: 'nombre', width: 30 },
      { header: 'MARCA', key: 'marca', width: 18 },
      { header: 'MODELO', key: 'modelo', width: 18 },
      { header: 'SERIAL', key: 'serial', width: 20 },
      { header: 'TIPO', key: 'tipo', width: 15 },
      { header: 'ESTADO', key: 'estado', width: 16 },
      { header: 'VALOR UNIT.', key: 'valorUnitario', width: 14 },
      { header: 'BODEGA', key: 'bodega', width: 22 },
      { header: 'CLIENTE', key: 'cliente', width: 22 },
      { header: 'UBICACIÓN', key: 'ubicacion', width: 30 },
      { header: 'F. ACTUALIZACIÓN', key: 'fecha', width: 22 },
    ];

    // Estilo encabezado - Naranja para herramientas
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'ED7D31' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    for (const inv of herramientas) {
      sheet.addRow({
        nombre: inv.tool?.nombre || '',
        marca: inv.tool?.marca || '',
        modelo: inv.tool?.modelo || '',
        serial: inv.tool?.serial || '',
        tipo: inv.tool?.tipo || 'Herramienta',
        estado: inv.tool?.estado || 'N/A',
        valorUnitario: Number(inv.valorUnitario ?? 0),
        bodega: inv.bodega?.nombre || 'SIN BODEGA',
        cliente: inv.bodega?.cliente?.nombre || '',
        ubicacion: inv.ubicacion || '',
        fecha:
          inv.fechaUltimaActualizacion instanceof Date
            ? inv.fechaUltimaActualizacion
            : inv.fechaUltimaActualizacion
              ? new Date(inv.fechaUltimaActualizacion as any)
              : null,
      });
    }

    // Formato numérico
    const col = sheet.getColumn('valorUnitario');
    col.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber > 1) {
        cell.numFmt = '"$"#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });
  }

  // ===== HOJA DE EQUIPOS =====
  if (equipos.length > 0) {
    const sheet = workbook.addWorksheet('EQUIPOS');

    sheet.columns = [
      { header: 'CÓDIGO', key: 'codigo', width: 15 },
      { header: 'NOMBRE', key: 'nombre', width: 30 },
      { header: 'MARCA', key: 'marca', width: 18 },
      { header: 'MODELO', key: 'modelo', width: 18 },
      { header: 'SERIAL', key: 'serial', width: 20 },
      { header: 'TIPO', key: 'tipo', width: 15 },
      { header: 'ESTADO', key: 'estado', width: 16 },
      { header: 'VALOR UNIT.', key: 'valorUnitario', width: 14 },
      { header: 'BODEGA', key: 'bodega', width: 22 },
      { header: 'CLIENTE', key: 'cliente', width: 22 },
      { header: 'UBICACIÓN', key: 'ubicacion', width: 30 },
      { header: 'F. ACTUALIZACIÓN', key: 'fecha', width: 22 },
    ];

    // Estilo encabezado - Verde para equipos
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '70AD47' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    for (const inv of equipos) {
      sheet.addRow({
        nombre: inv.tool?.nombre || '',
        marca: inv.tool?.marca || '',
        modelo: inv.tool?.modelo || '',
        serial: inv.tool?.serial || '',
        tipo: inv.tool?.tipo || 'Equipo',
        estado: inv.tool?.estado || 'N/A',
        valorUnitario: Number(inv.valorUnitario ?? 0),
        bodega: inv.bodega?.nombre || 'SIN BODEGA',
        cliente: inv.bodega?.cliente?.nombre || '',
        ubicacion: inv.ubicacion || '',
        fecha:
          inv.fechaUltimaActualizacion instanceof Date
            ? inv.fechaUltimaActualizacion
            : inv.fechaUltimaActualizacion
              ? new Date(inv.fechaUltimaActualizacion as any)
              : null,
      });
    }

    // Formato numérico
    const col = sheet.getColumn('valorUnitario');
    col.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber > 1) {
        cell.numFmt = '"$"#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });
  }

  // ===== HOJA DE RESUMEN ===== (siempre se crea)
  const summarySheet = workbook.addWorksheet('RESUMEN');

  summarySheet.columns = [
    { header: 'TIPO', key: 'tipo', width: 20 },
    { header: 'CANTIDAD DE ÍTEMS', key: 'cantidad', width: 20 },
    { header: 'VALOR TOTAL', key: 'valorTotal', width: 20 },
  ];

  // Estilo encabezado
  summarySheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'D9D9D9' },
    };
    cell.alignment = { horizontal: 'center' };
  });

  // Calcular valores totales
  const valorInsumos = insumos.reduce(
    (sum, inv) =>
      sum + Number(inv.cantidadActual ?? 0) * Number(inv.valorUnitario ?? 0),
    0,
  );
  const valorHerramientas = herramientas.reduce(
    (sum, inv) => sum + Number(inv.valorUnitario ?? 0),
    0,
  );
  const valorEquipos = equipos.reduce(
    (sum, inv) => sum + Number(inv.valorUnitario ?? 0),
    0,
  );

  // Filas de resumen
  const rows = [
    { tipo: 'INSUMOS', cantidad: insumos.length, valorTotal: valorInsumos },
    {
      tipo: 'HERRAMIENTAS',
      cantidad: herramientas.length,
      valorTotal: valorHerramientas,
    },
    { tipo: 'EQUIPOS', cantidad: equipos.length, valorTotal: valorEquipos },
  ];

  rows.forEach((row) => {
    summarySheet.addRow(row);
  });

  // Fila de totales
  const totalRow = summarySheet.addRow({
    tipo: 'TOTAL GENERAL',
    cantidad: inventories.length,
    valorTotal: valorInsumos + valorHerramientas + valorEquipos,
  });
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'E2EFDA' },
  };

  // Formato moneda en resumen
  const valorCol = summarySheet.getColumn('valorTotal');
  valorCol.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.numFmt = '"$"#,##0.00';
      cell.alignment = { horizontal: 'right' };
    }
  });

  // Centrar la columna de cantidad
  const cantidadCol = summarySheet.getColumn('cantidad');
  cantidadCol.alignment = { horizontal: 'center' };

  const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  return buffer;
}
