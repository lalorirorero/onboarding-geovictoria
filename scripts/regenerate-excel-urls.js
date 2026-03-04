import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import path from "path";

const STORAGE_BUCKET = "onboarding-excels";
const SIGNED_URL_TTL_SECONDS = 30 * 24 * 60 * 60;
const TEMPLATE_PATH = path.join(process.cwd(), "assets", "templates", "PLANTILLA_INGRESO.xlsx");

const ONBOARDING_ID = "40a93587-1ab3-4fd0-906e-8f2fcaeaf21c";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const sanitizeRut = (rut) => (rut || "sin-rut").replace(/\./g, "").replace(/-/g, "").trim() || "sin-rut";
const normalizeRutForExcel = (rut) => (rut || "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();

const formatTimestamp = () => {
  const now = new Date();
  const pad = (v) => String(v).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const splitNombre = (nombreCompleto) => {
  const trimmed = (nombreCompleto || "").trim();
  if (!trimmed) return { nombres: "", apellidos: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { nombres: parts[0], apellidos: "" };
  return { nombres: parts.slice(0, -1).join(" "), apellidos: parts.slice(-1).join(" ") };
};

const pickPhone = (trabajador, index) => {
  const direct = trabajador?.[`telefono${index}`] || trabajador?.[`telefono_${index}`];
  if (direct) return direct;
  if (Array.isArray(trabajador?.telefonos)) {
    const fromArray = trabajador.telefonos[index - 1];
    if (fromArray) return fromArray;
  }
  if (index === 1) return trabajador?.telefono || trabajador?.telefonoContacto || "";
  return "";
};

const setExcelCell = (sheet, cellAddress, value) => {
  if (value === undefined || value === null || value === "") return;
  sheet.getCell(cellAddress).value = value;
};

// --- Build Usuarios Excel (XLSX/SheetJS - same as production) ---
function buildUsuariosWorkbook(datos) {
  const empresa = datos.empresa || {};
  const admins = Array.isArray(datos.admins) ? datos.admins : [];
  const trabajadores = Array.isArray(datos.trabajadores) ? datos.trabajadores : [];
  const empresaRut = normalizeRutForExcel(empresa.rut);

  const headers = [
    "identificador", "email", "email alternativo comprobantes",
    "nombre", "apellido", "grupo", "fono1", "fono2", "fono3",
    "identificador razon social", "tipo",
  ];

  const adminsRows = admins.map((admin) => [
    normalizeRutForExcel(admin?.rut),
    admin?.email || "",
    "",
    admin?.nombre || "",
    admin?.apellido || "",
    "",
    admin?.telefono || "",
    "", "",
    empresaRut,
    "administrador",
  ]);

  const trabajadoresRows = trabajadores.map((t) => {
    const { nombres, apellidos } = splitNombre(t?.nombre);
    return [
      normalizeRutForExcel(t?.rut),
      t?.correo || "",
      "",
      nombres,
      apellidos,
      t?.grupoNombre || t?.grupo || "",
      pickPhone(t, 1),
      pickPhone(t, 2),
      pickPhone(t, 3),
      empresaRut,
      "usuario",
    ];
  });

  const rows = [...adminsRows, ...trabajadoresRows];
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Usuarios");
  return wb;
}

// --- Build Planificaciones Excel (ExcelJS with template - same as production) ---
async function buildPlanificacionWorkbook(datos) {
  const empresa = datos.empresa || {};
  const admins = Array.isArray(datos.admins) ? datos.admins : [];
  const trabajadores = Array.isArray(datos.trabajadores) ? datos.trabajadores : [];
  const turnos = Array.isArray(datos.turnos) ? datos.turnos : [];
  const planificaciones = Array.isArray(datos.planificaciones) ? datos.planificaciones : [];
  const asignaciones = Array.isArray(datos.asignaciones) ? datos.asignaciones : [];

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  const sheet = wb.getWorksheet("Trabajadores");
  if (!sheet) {
    throw new Error("No se encontro la hoja 'Trabajadores' en la plantilla.");
  }

  // Fill empresa data
  setExcelCell(sheet, "C7", empresa.razonSocial || "");
  setExcelCell(sheet, "C8", empresa.nombreFantasia || "");
  setExcelCell(sheet, "C9", empresa.rut || "");
  setExcelCell(sheet, "C10", empresa.giro || "");
  setExcelCell(sheet, "C11", empresa.direccion || "");
  setExcelCell(sheet, "C12", empresa.comuna || "");
  setExcelCell(sheet, "C13", empresa.emailFacturacion || "");
  setExcelCell(sheet, "C14", empresa.telefonoContacto || "");
  setExcelCell(sheet, "C15", Array.isArray(empresa.sistema) ? empresa.sistema.join(", ") : empresa.sistema || "");
  setExcelCell(sheet, "C16", empresa.rubro || "");

  const workerHeaderRowIndex = 25;
  const adminBlockStartRow = 18;
  const adminBlockHeight = 5;
  const adminSpacerRows = 1;
  const cloneStyle = (style) => style ? JSON.parse(JSON.stringify(style)) : undefined;
  const adminCount = admins.length > 0 ? admins.length : 1;

  // Clone admin blocks
  const merges = (sheet._merges && Object.keys(sheet._merges)) || [];
  const baseMergeRanges = merges
    .map((range) => {
      const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (!match) return null;
      const startRow = Number(match[2]);
      const endRow = Number(match[4]);
      if (startRow >= adminBlockStartRow && endRow <= adminBlockStartRow + adminBlockHeight - 1) {
        return { range, startRow, endRow };
      }
      return null;
    })
    .filter(Boolean);

  for (let i = 1; i < adminCount; i++) {
    const insertRow = adminBlockStartRow + i * (adminBlockHeight + adminSpacerRows);
    sheet.spliceRows(insertRow, 0, ...Array(adminBlockHeight + adminSpacerRows).fill([]));

    for (let rowOffset = 0; rowOffset < adminBlockHeight; rowOffset++) {
      const sourceRow = sheet.getRow(adminBlockStartRow + rowOffset);
      const targetRow = sheet.getRow(insertRow + rowOffset);
      targetRow.height = sourceRow.height;
      sourceRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const targetCell = targetRow.getCell(colNumber);
        targetCell.style = cloneStyle(cell.style) || {};
        if (colNumber === 2) {
          targetCell.value = cell.value;
        } else {
          targetCell.value = null;
        }
      });
    }

    baseMergeRanges.forEach((merge) => {
      const rowOffset = insertRow - adminBlockStartRow;
      const range = merge.range.replace(/(\d+)/g, (match) => String(Number(match) + rowOffset));
      sheet.mergeCells(range);
    });
  }

  // Fill admin data
  for (let i = 0; i < adminCount; i++) {
    const admin = admins[i] || null;
    const blockStartRow = adminBlockStartRow + i * (adminBlockHeight + adminSpacerRows);
    const adminNombre = admin ? [admin?.nombre, admin?.apellido].filter(Boolean).join(" ") : "Sin administradores";
    setExcelCell(sheet, `B${blockStartRow}`, `Datos Administrador ${i + 1} del Sistema`);
    setExcelCell(sheet, `C${blockStartRow + 1}`, adminNombre);
    setExcelCell(sheet, `C${blockStartRow + 2}`, admin?.rut || "");
    setExcelCell(sheet, `C${blockStartRow + 3}`, admin?.telefono || "");
    setExcelCell(sheet, `C${blockStartRow + 4}`, admin?.email || "");
  }

  const insertedRows = (adminCount - 1) * (adminBlockHeight + adminSpacerRows);
  const newWorkerHeaderRowIndex = workerHeaderRowIndex + insertedRows;
  setExcelCell(sheet, `J${newWorkerHeaderRowIndex}`, "Col");

  const phoneColumns = [30, 31, 32];
  phoneColumns.forEach((col) => {
    const column = sheet.getColumn(col);
    if (!column.width || column.width < 16) {
      column.width = 16;
    }
  });

  const findTurno = (turnoId) => turnos.find((turno) => String(turno.id) === String(turnoId));
  const hasLibre = (turno) => {
    const nombre = String(turno?.nombre || "").toLowerCase();
    return nombre.includes("libre") || nombre.includes("descanso");
  };
  const findAsignacion = (trabajadorId) =>
    asignaciones.find(
      (asig) => String(asig.trabajadorId) === String(trabajadorId) && asig.planificacionId && asig.desde && asig.hasta
    );

  const startRow = newWorkerHeaderRowIndex + 1;
  trabajadores.forEach((trabajador, index) => {
    const rowIndex = startRow + index;
    const { nombres, apellidos } = splitNombre(trabajador?.nombre);
    const grupo = trabajador?.grupoNombre || trabajador?.grupo || "";

    const asignacion = findAsignacion(trabajador?.id);
    const plan = planificaciones.find((p) => String(p.id) === String(asignacion?.planificacionId));
    const fechaInicio = asignacion?.desde || "";
    const fechaFin = asignacion?.hasta === "permanente" ? "PERMANENTE" : asignacion?.hasta || "";

    const rowValues = [
      trabajador?.rut || "",
      trabajador?.correo || "",
      nombres,
      apellidos,
      grupo,
      fechaInicio,
      fechaFin,
    ];

    const diasTurnos = Array.isArray(plan?.diasTurnos) ? plan.diasTurnos : Array(7).fill(null);
    diasTurnos.forEach((turnoId) => {
      const turno = findTurno(turnoId);
      if (!turno || hasLibre(turno)) {
        rowValues.push("", "", "");
        return;
      }
      let colacionValue = "";
      if (turno?.tipoColacion) {
        const tipo = turno.tipoColacion.toLowerCase();
        if (tipo === "sin") {
          colacionValue = "Sin Colacion";
        } else if (tipo === "libre") {
          colacionValue = turno.colacionMinutos ? `${turno.colacionMinutos} min libre` : "Colacion libre";
        } else if (tipo === "fija") {
          colacionValue = turno.colacionInicio && turno.colacionFin
            ? `${turno.colacionInicio} - ${turno.colacionFin}`
            : "Colacion fija";
        }
      } else {
        colacionValue = turno.colacionMinutos || "";
      }
      rowValues.push(turno.horaInicio || "", colacionValue, turno.horaFin || "");
    });

    const row = sheet.getRow(rowIndex);
    rowValues.forEach((value, valueIndex) => {
      if (value === undefined || value === null || value === "") return;
      row.getCell(2 + valueIndex).value = value;
    });
    phoneColumns.forEach((col, idx) => {
      const phoneValue = pickPhone(trabajador, idx + 1);
      if (phoneValue) {
        row.getCell(col).value = phoneValue;
      }
    });
  });

  return wb;
}

async function main() {
  console.log("=== Regenerando Excel y Signed URLs (con plantilla) ===");
  console.log("Onboarding ID:", ONBOARDING_ID);

  // 1. Obtener datos del registro
  const { data: record, error: fetchError } = await supabase
    .from("onboardings")
    .select("*")
    .eq("id", ONBOARDING_ID)
    .single();

  if (fetchError || !record) {
    console.error("Error obteniendo registro:", fetchError);
    process.exit(1);
  }

  const datos = record.datos_actuales;
  const empresa = datos.empresa || {};
  const admins = Array.isArray(datos.admins) ? datos.admins : [];
  const trabajadores = Array.isArray(datos.trabajadores) ? datos.trabajadores : [];

  console.log("Empresa:", empresa.razonSocial);
  console.log("Admins:", admins.length);
  console.log("Trabajadores:", trabajadores.length);

  const rutKey = sanitizeRut(empresa.rut);
  const timestamp = formatTimestamp();

  // 2. Generar Excel de Usuarios (XLSX - same as production)
  console.log("\n--- Generando Excel de Usuarios ---");
  const usuariosWorkbook = buildUsuariosWorkbook(datos);
  const usuariosBuffer = XLSX.write(usuariosWorkbook, { type: "buffer", bookType: "xlsx" });
  console.log("Excel de Usuarios generado");

  // 3. Generar Excel de Planificaciones (ExcelJS con plantilla - same as production)
  console.log("\n--- Generando Excel de Planificaciones (con plantilla formateada) ---");
  const planificacionesWorkbook = await buildPlanificacionWorkbook(datos);
  const planificacionesBuffer = Buffer.from(await planificacionesWorkbook.xlsx.writeBuffer());
  console.log("Excel de Planificaciones generado con formato de plantilla");

  // 4. Subir a Supabase Storage
  console.log("\n--- Subiendo a Supabase Storage ---");
  const usuariosFilename = `usuarios-${rutKey}-${timestamp}.xlsx`;
  const planificacionesFilename = `planificaciones-${rutKey}-${timestamp}.xlsx`;
  const usuariosPath = `onboarding/${rutKey}/${usuariosFilename}`;
  const planificacionesPath = `onboarding/${rutKey}/${planificacionesFilename}`;

  const uploadOptions = {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  };

  const { error: err1 } = await supabase.storage.from(STORAGE_BUCKET).upload(usuariosPath, usuariosBuffer, uploadOptions);
  if (err1) { console.error("Error subiendo usuarios:", err1); process.exit(1); }
  console.log("Usuarios subido:", usuariosPath);

  const { error: err2 } = await supabase.storage.from(STORAGE_BUCKET).upload(planificacionesPath, planificacionesBuffer, uploadOptions);
  if (err2) { console.error("Error subiendo planificaciones:", err2); process.exit(1); }
  console.log("Planificaciones subido:", planificacionesPath);

  // 5. Generar Signed URLs (30 dias)
  console.log("\n--- Generando Signed URLs (30 dias) ---");
  const { data: sig1, error: sigErr1 } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(usuariosPath, SIGNED_URL_TTL_SECONDS);
  if (sigErr1) { console.error("Error signed URL usuarios:", sigErr1); process.exit(1); }

  const { data: sig2, error: sigErr2 } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(planificacionesPath, SIGNED_URL_TTL_SECONDS);
  if (sigErr2) { console.error("Error signed URL planificaciones:", sigErr2); process.exit(1); }

  const urlUsuarios = sig1.signedUrl;
  const urlPlanificaciones = sig2.signedUrl;

  console.log("\n========================================");
  console.log("URL USUARIOS:");
  console.log(urlUsuarios);
  console.log("\nURL PLANIFICACIONES:");
  console.log(urlPlanificaciones);
  console.log("========================================");

  // 6. Actualizar registro en BD
  console.log("\n--- Actualizando registro en BD ---");
  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

  const mergedDatos = {
    ...datos,
    excelUrls: {
      usuarios: { filename: usuariosFilename, url: urlUsuarios },
      planificaciones: { filename: planificacionesFilename, url: urlPlanificaciones },
    },
    excelUrlUsuarios: urlUsuarios,
    excelUrlPlanificaciones: urlPlanificaciones,
  };

  const { error: updateError } = await supabase
    .from("onboardings")
    .update({
      datos_actuales: mergedDatos,
      fecha_ultima_actualizacion: new Date().toISOString(),
    })
    .eq("id", ONBOARDING_ID);

  if (updateError) {
    console.error("Error actualizando registro:", updateError);
  } else {
    console.log("Registro actualizado correctamente en BD");
  }

  console.log("\n=== PROCESO COMPLETADO ===");
  console.log("URLs validas hasta:", expiresAt);
}

main().catch(console.error);
