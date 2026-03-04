import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, "..", "assets", "templates", "PLANTILLA_INGRESO.xlsx");
const STORAGE_BUCKET = "onboarding-excels";
const SIGNED_URL_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 dias

const ONBOARDING_ID = "40a93587-1ab3-4fd0-906e-8f2fcaeaf21c";
const ID_ZOHO = "3525045000583110448";

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

const setExcelCell = (sheet, cellAddress, value) => {
  if (value === undefined || value === null || value === "") return;
  sheet.getCell(cellAddress).value = value;
};

async function main() {
  console.log("=== Regenerando Excel y Signed URLs ===");
  console.log("Onboarding ID:", ONBOARDING_ID);
  console.log("ID Zoho:", ID_ZOHO);

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
  const turnos = Array.isArray(datos.turnos) ? datos.turnos : [];
  const planificaciones = Array.isArray(datos.planificaciones) ? datos.planificaciones : [];
  const asignaciones = Array.isArray(datos.asignaciones) ? datos.asignaciones : [];

  console.log("Empresa:", empresa.razonSocial);
  console.log("Admins:", admins.length);
  console.log("Trabajadores:", trabajadores.length);
  console.log("Turnos:", turnos.length);
  console.log("Planificaciones:", planificaciones.length);

  // 2. Generar Excel de Usuarios
  console.log("\n--- Generando Excel de Usuarios ---");
  const headers = [
    "identificador", "email", "email alternativo comprobantes",
    "nombre", "apellido", "grupo", "fono1", "fono2", "fono3",
    "identificador razon social", "tipo",
  ];

  const empresaRut = normalizeRutForExcel(empresa.rut);

  const adminsRows = admins.map((admin) => [
    normalizeRutForExcel(admin.rut),
    admin.email || "",
    "",
    admin.nombre || "",
    admin.apellido || "",
    "",
    admin.telefono || "",
    "", "",
    empresaRut,
    "administrador",
  ]);

  const trabajadoresRows = trabajadores.map((t) => {
    const nombre = (t.nombre || "").trim();
    const parts = nombre.split(/\s+/);
    const nombres = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "";
    const apellidos = parts.length > 1 ? parts.slice(-1).join(" ") : "";
    return [
      normalizeRutForExcel(t.rut),
      t.correo || "",
      "",
      nombres,
      apellidos,
      t.grupoNombre || t.grupo || "",
      t.telefono || t.telefono1 || "",
      t.telefono2 || "",
      t.telefono3 || "",
      empresaRut,
      "usuario",
    ];
  });

  const rows = [...adminsRows, ...trabajadoresRows];
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Usuarios");

  const usuariosBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  console.log("Excel de Usuarios generado:", rows.length, "filas");

  // 3. Generar Excel de Planificaciones
  console.log("\n--- Generando Excel de Planificaciones ---");
  const planWb = new ExcelJS.Workbook();
  await planWb.xlsx.readFile(TEMPLATE_PATH);
  const planSheet = planWb.getWorksheet("Trabajadores");

  if (!planSheet) {
    console.error("No se encontro la hoja 'Trabajadores' en la plantilla.");
    process.exit(1);
  }

  setExcelCell(planSheet, "C7", empresa.razonSocial || "");
  setExcelCell(planSheet, "C8", empresa.nombreFantasia || "");
  setExcelCell(planSheet, "C9", empresa.rut || "");
  setExcelCell(planSheet, "C10", empresa.giro || "");
  setExcelCell(planSheet, "C11", empresa.direccion || "");
  setExcelCell(planSheet, "C12", empresa.comuna || "");
  setExcelCell(planSheet, "C13", empresa.emailFacturacion || "");
  setExcelCell(planSheet, "C14", empresa.telefonoContacto || "");
  setExcelCell(planSheet, "C15", Array.isArray(empresa.sistema) ? empresa.sistema.join(", ") : empresa.sistema || "");
  setExcelCell(planSheet, "C16", empresa.rubro || "");

  // Admin data
  const adminBlockStartRow = 18;
  for (let i = 0; i < Math.max(admins.length, 1); i++) {
    const admin = admins[i] || null;
    const blockStartRow = adminBlockStartRow + i * 6;
    const adminNombre = admin ? [admin.nombre, admin.apellido].filter(Boolean).join(" ") : "Sin administradores";
    setExcelCell(planSheet, `B${blockStartRow}`, `Datos Administrador ${i + 1} del Sistema`);
    setExcelCell(planSheet, `C${blockStartRow + 1}`, adminNombre);
    setExcelCell(planSheet, `C${blockStartRow + 2}`, admin?.rut || "");
    setExcelCell(planSheet, `C${blockStartRow + 3}`, admin?.telefono || "");
    setExcelCell(planSheet, `C${blockStartRow + 4}`, admin?.email || "");
  }

  const planificacionesBuffer = Buffer.from(await planWb.xlsx.writeBuffer());
  console.log("Excel de Planificaciones generado");

  // 4. Subir a Supabase Storage
  console.log("\n--- Subiendo a Supabase Storage ---");
  const rutKey = sanitizeRut(empresa.rut);
  const timestamp = formatTimestamp();
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
    console.log("Registro actualizado correctamente");
  }

  // 7. Insertar en onboarding_excels
  const excelRows = [
    {
      onboarding_id: ONBOARDING_ID,
      empresa_rut: empresa.rut || null,
      tipo: "usuarios",
      filename: usuariosFilename,
      url: urlUsuarios,
      expires_at: expiresAt,
    },
    {
      onboarding_id: ONBOARDING_ID,
      empresa_rut: empresa.rut || null,
      tipo: "planificaciones",
      filename: planificacionesFilename,
      url: urlPlanificaciones,
      expires_at: expiresAt,
    },
  ];

  const { error: insertError } = await supabase.from("onboarding_excels").insert(excelRows);
  if (insertError) {
    console.error("Error insertando en onboarding_excels:", insertError);
  } else {
    console.log("Registros insertados en onboarding_excels");
  }

  console.log("\n=== PROCESO COMPLETADO ===");
  console.log("Expiran:", expiresAt);
}

main().catch(console.error);
