import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

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

  const empresaRut = normalizeRutForExcel(empresa.rut);
  const rutKey = sanitizeRut(empresa.rut);
  const timestamp = formatTimestamp();

  // 2. Generar Excel de Usuarios
  console.log("\n--- Generando Excel de Usuarios ---");
  const userHeaders = [
    "identificador", "email", "email alternativo comprobantes",
    "nombre", "apellido", "grupo", "fono1", "fono2", "fono3",
    "identificador razon social", "tipo",
  ];

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

  const allUserRows = [...adminsRows, ...trabajadoresRows];
  const userSheet = XLSX.utils.aoa_to_sheet([userHeaders, ...allUserRows]);
  const userWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(userWb, userSheet, "Usuarios");
  const usuariosBuffer = XLSX.write(userWb, { type: "buffer", bookType: "xlsx" });
  console.log("Excel de Usuarios generado:", allUserRows.length, "filas");

  // 3. Generar Excel de Planificaciones
  console.log("\n--- Generando Excel de Planificaciones ---");
  const planHeaders = [
    "Razon Social", empresa.razonSocial || "",
    "", "Nombre Fantasia", empresa.nombreFantasia || "",
  ];
  const planInfoRows = [
    ["RUT Empresa", empresa.rut || ""],
    ["Giro", empresa.giro || ""],
    ["Direccion", empresa.direccion || ""],
    ["Comuna", empresa.comuna || ""],
    ["Email Facturacion", empresa.emailFacturacion || ""],
    ["Telefono", empresa.telefonoContacto || ""],
    ["Sistema", Array.isArray(empresa.sistema) ? empresa.sistema.join(", ") : empresa.sistema || ""],
    ["Rubro", empresa.rubro || ""],
    [],
    ["--- ADMINISTRADORES ---"],
  ];

  admins.forEach((admin, i) => {
    planInfoRows.push([`Admin ${i + 1}`, [admin.nombre, admin.apellido].filter(Boolean).join(" ")]);
    planInfoRows.push(["  RUT", admin.rut || ""]);
    planInfoRows.push(["  Email", admin.email || ""]);
    planInfoRows.push(["  Telefono", admin.telefono || ""]);
    planInfoRows.push([]);
  });

  if (turnos.length > 0) {
    planInfoRows.push(["--- TURNOS ---"]);
    turnos.forEach((turno) => {
      if (turno.id > 0) {
        planInfoRows.push([`Turno: ${turno.nombre}`, `${turno.horaInicio} - ${turno.horaFin}`, `Colacion: ${turno.colacionMinutos} min`]);
      }
    });
    planInfoRows.push([]);
  }

  if (planificaciones.length > 0) {
    planInfoRows.push(["--- PLANIFICACIONES ---"]);
    planificaciones.forEach((p) => {
      planInfoRows.push([`Planificacion: ${p.nombre}`, `Tipo: ${p.tipo}`, `Dias: ${p.diasTrabajo}`]);
    });
    planInfoRows.push([]);
  }

  if (asignaciones.length > 0) {
    planInfoRows.push(["--- ASIGNACIONES ---"]);
    asignaciones.forEach((a) => {
      planInfoRows.push([`Grupo: ${a.grupoNombre || ""}`, `Planificacion: ${a.planificacionNombre || ""}`]);
    });
  }

  const planSheet = XLSX.utils.aoa_to_sheet(planInfoRows);
  const planWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(planWb, planSheet, "Planificaciones");
  const planificacionesBuffer = XLSX.write(planWb, { type: "buffer", bookType: "xlsx" });
  console.log("Excel de Planificaciones generado");

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
