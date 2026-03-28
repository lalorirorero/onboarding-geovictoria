const MODULO_DASHBOARD_BI = "Dashboard BI"
const MODULO_DASHBOARD_BI_LEGACY = "Dasboard BI"

export const normalizeModuloAdicional = (value = "") => {
  const normalized = String(value || "").trim()
  if (!normalized) return ""
  return normalized === MODULO_DASHBOARD_BI_LEGACY ? MODULO_DASHBOARD_BI : normalized
}

export const normalizeModulosAdicionales = (values) => {
  const normalizedValues = Array.isArray(values)
    ? values.map((value) => normalizeModuloAdicional(value || "")).filter((value) => value.length > 0)
    : []
  return Array.from(new Set(normalizedValues))
}

export const buildNormalizedZohoPayload = (incomingPayload = {}) => {
  const incomingFormData = incomingPayload.formData ?? {}
  const incomingEmpresa = incomingFormData.empresa ?? {}

  const safeEmpresa = {
    id_zoho: incomingEmpresa.id_zoho ?? incomingPayload.id_zoho ?? null,
    razonSocial: incomingEmpresa.razonSocial || "",
    nombreFantasia: incomingEmpresa.nombreFantasia || "",
    rut: incomingEmpresa.rut || "",
    giro: incomingEmpresa.giro || "",
    direccion: incomingEmpresa.direccion || "",
    comuna: incomingEmpresa.comuna || "",
    emailFacturacion: incomingEmpresa.emailFacturacion || "",
    telefonoContacto: incomingEmpresa.telefonoContacto || "",
    ejecutivoTelefono: incomingEmpresa.ejecutivoTelefono || "",
    ejecutivoNombre: incomingEmpresa.ejecutivoNombre || "",
    sistema: Array.isArray(incomingEmpresa.sistema) ? incomingEmpresa.sistema : [],
    modulosAdicionales: normalizeModulosAdicionales(incomingEmpresa.modulosAdicionales),
    modulosAdicionalesOtro: incomingEmpresa.modulosAdicionalesOtro || "",
    rubro: incomingEmpresa.rubro || "",
    grupos: Array.isArray(incomingEmpresa.grupos) ? incomingEmpresa.grupos : [],
  }

  const safeFormData = {
    empresa: safeEmpresa,
    admins: Array.isArray(incomingFormData.admins) ? incomingFormData.admins : [],
    trabajadores: Array.isArray(incomingFormData.trabajadores) ? incomingFormData.trabajadores : [],
    turnos: Array.isArray(incomingFormData.turnos) ? incomingFormData.turnos : [],
    planificaciones: Array.isArray(incomingFormData.planificaciones) ? incomingFormData.planificaciones : [],
    asignaciones: Array.isArray(incomingFormData.asignaciones) ? incomingFormData.asignaciones : [],
    configureNow: Boolean(incomingFormData.configureNow),
  }

  const metadataPasoActual =
    typeof incomingPayload.metadata?.pasoActual === "number"
      ? incomingPayload.metadata.pasoActual
      : typeof incomingPayload.currentStep === "number"
        ? incomingPayload.currentStep
        : 0
  const metadataTotalPasos = typeof incomingPayload.metadata?.totalPasos === "number" ? incomingPayload.metadata.totalPasos : 0
  const metadataPorcentaje =
    typeof incomingPayload.metadata?.porcentajeProgreso === "number" ? incomingPayload.metadata.porcentajeProgreso : 0
  const metadataEmpresaRut = incomingPayload.metadata?.empresaRut || safeEmpresa.rut || "Sin RUT"
  const metadataEmpresaNombre =
    incomingPayload.metadata?.empresaNombre || safeEmpresa.razonSocial || safeEmpresa.nombreFantasia || "Sin nombre"
  const metadataPasoNombre = incomingPayload.metadata?.pasoNombre || `Paso ${metadataPasoActual}`
  const metadataTotalTrabajadores =
    typeof incomingPayload.metadata?.totalTrabajadores === "number"
      ? incomingPayload.metadata.totalTrabajadores
      : safeFormData.trabajadores.length
  const metadataTotalGrupos =
    typeof incomingPayload.metadata?.totalGrupos === "number" ? incomingPayload.metadata.totalGrupos : safeEmpresa.grupos.length
  const metadataDecision = typeof incomingPayload.metadata?.decision === "string" ? incomingPayload.metadata.decision : ""

  return {
    accion: incomingPayload.accion === "completado" ? "completado" : "progreso",
    fechaHoraEnvio:
      typeof incomingPayload.fechaHoraEnvio === "string" && incomingPayload.fechaHoraEnvio.trim() !== ""
        ? incomingPayload.fechaHoraEnvio
        : new Date().toISOString(),
    eventType: incomingPayload.eventType === "complete" ? "complete" : "progress",
    id_zoho: incomingPayload.id_zoho ?? safeEmpresa.id_zoho ?? null,
    onboardingId: incomingPayload.onboardingId ?? null,
    currentStep: typeof incomingPayload.currentStep === "number" ? incomingPayload.currentStep : metadataPasoActual,
    navigationHistory: Array.isArray(incomingPayload.navigationHistory) ? incomingPayload.navigationHistory : [],
    estado:
      incomingPayload.estado ||
      (incomingPayload.eventType === "complete" || incomingPayload.accion === "completado" ? "Completado" : "En Curso"),
    fecha_completado: incomingPayload.fecha_completado ?? null,
    totalTrabajadores:
      typeof incomingPayload.totalTrabajadores === "number" ? incomingPayload.totalTrabajadores : safeFormData.trabajadores.length,
    formData: safeFormData,
    metadata: {
      empresaRut: metadataEmpresaRut,
      empresaNombre: metadataEmpresaNombre,
      pasoActual: metadataPasoActual,
      pasoNombre: metadataPasoNombre,
      totalPasos: metadataTotalPasos,
      porcentajeProgreso: metadataPorcentaje,
      totalTrabajadores: metadataTotalTrabajadores,
      totalGrupos: metadataTotalGrupos,
      decision: metadataDecision,
    },
    excelUrls: {
      usuarios: incomingPayload.excelUrls?.usuarios || { filename: "", url: "" },
      planificaciones: incomingPayload.excelUrls?.planificaciones || { filename: "", url: "" },
    },
    excelUrlUsuarios: incomingPayload.excelUrlUsuarios || incomingPayload.excelUrls?.usuarios?.url || "",
    excelUrlPlanificaciones: incomingPayload.excelUrlPlanificaciones || incomingPayload.excelUrls?.planificaciones?.url || "",
    excelFile: incomingPayload.excelFile ?? null,
  }
}

