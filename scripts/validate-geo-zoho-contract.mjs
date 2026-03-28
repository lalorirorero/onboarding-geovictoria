import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { buildNormalizedZohoPayload } from "../lib/zoho-payload-contract.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")
const snapshotsDir = path.join(rootDir, "contracts", "geo")
const submitToZohoRoutePath = path.join(rootDir, "app", "api", "submit-to-zoho", "route.ts")

const snapshots = {
  progress: path.join(snapshotsDir, "zoho-payload-progress-v1.json"),
  complete: path.join(snapshotsDir, "zoho-payload-complete-v1.json"),
}

const fixtures = {
  progress: {
    accion: "progreso",
    fechaHoraEnvio: "2026-03-28T12:00:00.000Z",
    eventType: "progress",
    id_zoho: "APP-GEO-TEST-001",
    onboardingId: "onb_geo_001",
    currentStep: 2,
    navigationHistory: [0, 1, 2],
    estado: "En Curso",
    fecha_completado: null,
    totalTrabajadores: 1,
    formData: {
      empresa: {
        id_zoho: "APP-GEO-TEST-001",
        razonSocial: "Geo Empresa Test",
        nombreFantasia: "Geo Test",
        rut: "12345678-9",
        giro: "Servicios",
        direccion: "Calle 123",
        comuna: "Santiago",
        emailFacturacion: "facturacion@geo.test",
        telefonoContacto: "+56911112222",
        ejecutivoTelefono: "+56999990000",
        ejecutivoNombre: "Ejecutivo Geo",
        sistema: ["GeoVictoria APP"],
        modulosAdicionales: ["Dasboard BI", "Permisos y Vacaciones"],
        modulosAdicionalesOtro: "",
        rubro: "20. Servicios",
        grupos: [{ id: 1, nombre: "OPERACIONES" }],
      },
      admins: [{ nombre: "Ana", apellido: "Admin", email: "ana@geo.test", telefono: "+56910000000", cargo: "RRHH" }],
      trabajadores: [{ nombre: "Pedro Trabajador", rut: "11111111-1", correo: "pedro@geo.test", grupo: "OPERACIONES" }],
      turnos: [],
      planificaciones: [],
      asignaciones: [],
      configureNow: false,
    },
    metadata: {
      empresaRut: "12345678-9",
      empresaNombre: "Geo Empresa Test",
      pasoActual: 2,
      pasoNombre: "Empresa",
      totalPasos: 12,
      porcentajeProgreso: 17,
      totalTrabajadores: 1,
      totalGrupos: 1,
      decision: "",
    },
    excelUrls: {
      usuarios: { filename: "", url: "" },
      planificaciones: { filename: "", url: "" },
    },
    excelUrlUsuarios: "",
    excelUrlPlanificaciones: "",
    excelFile: null,
  },
  complete: {
    accion: "completado",
    fechaHoraEnvio: "2026-03-28T12:30:00.000Z",
    eventType: "complete",
    id_zoho: "APP-GEO-TEST-999",
    onboardingId: "onb_geo_999",
    currentStep: 11,
    navigationHistory: [0, 1, 2, 3, 4, 5, 6, 10, 11],
    estado: "Completado",
    fecha_completado: "2026-03-28T12:29:59.000Z",
    totalTrabajadores: 2,
    formData: {
      empresa: {
        id_zoho: "APP-GEO-TEST-999",
        razonSocial: "Geo Empresa Final",
        nombreFantasia: "Geo Final",
        rut: "98765432-1",
        giro: "Tecnologia",
        direccion: "Av. Final 999",
        comuna: "Providencia",
        emailFacturacion: "facturacion@geofinal.test",
        telefonoContacto: "+56933334444",
        ejecutivoTelefono: "+56988887777",
        ejecutivoNombre: "Ejecutivo Final",
        sistema: ["GeoVictoria APP", "Portal Web"],
        modulosAdicionales: ["Dashboard BI"],
        modulosAdicionalesOtro: "",
        rubro: "20. Servicios",
        grupos: [
          { id: 1, nombre: "BODEGA" },
          { id: 2, nombre: "VENTAS" },
        ],
      },
      admins: [{ nombre: "Luis", apellido: "Admin", email: "luis@geo.test", telefono: "+56950000000", cargo: "Operaciones" }],
      trabajadores: [
        { nombre: "Trabajador Uno", rut: "11111111-1", correo: "uno@geo.test", grupo: "BODEGA" },
        { nombre: "Trabajador Dos", rut: "22222222-2", correo: "dos@geo.test", grupo: "VENTAS" },
      ],
      turnos: [{ id: "T1", nombre: "Manana", horaInicio: "08:00", horaFin: "17:00", diasSemana: [1, 2, 3, 4, 5], color: "#000000" }],
      planificaciones: [{ id: "P1", nombre: "Plan Semanal", fechaInicio: "2026-03-31", fechaFin: "2026-04-06", turnos: [{ turnoId: "T1", dias: ["lunes"] }] }],
      asignaciones: [{ trabajadorRut: "11111111-1", planificacionId: "P1" }],
      configureNow: true,
    },
    metadata: {
      empresaRut: "98765432-1",
      empresaNombre: "Geo Empresa Final",
      pasoActual: 11,
      pasoNombre: "Resumen",
      totalPasos: 12,
      porcentajeProgreso: 92,
      totalTrabajadores: 2,
      totalGrupos: 2,
      decision: "confirmar",
    },
    excelUrls: {
      usuarios: { filename: "usuarios.xlsx", url: "https://files.test/usuarios.xlsx" },
      planificaciones: { filename: "planificaciones.xlsx", url: "https://files.test/planificaciones.xlsx" },
    },
    excelUrlUsuarios: "https://files.test/usuarios.xlsx",
    excelUrlPlanificaciones: "https://files.test/planificaciones.xlsx",
    excelFile: null,
  },
}

const buildActualSnapshots = () => ({
  progress: buildNormalizedZohoPayload(fixtures.progress),
  complete: buildNormalizedZohoPayload(fixtures.complete),
})

const writeSnapshots = async () => {
  const actual = buildActualSnapshots()
  await mkdir(snapshotsDir, { recursive: true })
  await writeFile(snapshots.progress, `${JSON.stringify(actual.progress, null, 2)}\n`, "utf8")
  await writeFile(snapshots.complete, `${JSON.stringify(actual.complete, null, 2)}\n`, "utf8")
}

const readSnapshot = async (filePath) => {
  const raw = await readFile(filePath, "utf8")
  return JSON.parse(raw)
}

const validateSnapshots = async () => {
  const actual = buildActualSnapshots()
  const expectedProgress = await readSnapshot(snapshots.progress)
  const expectedComplete = await readSnapshot(snapshots.complete)
  const submitRouteSource = await readFile(submitToZohoRoutePath, "utf8")

  if (!submitRouteSource.includes("buildNormalizedZohoPayload")) {
    throw new Error(
      "[contract] /api/submit-to-zoho ya no usa buildNormalizedZohoPayload. El contrato GEO puede quedar sin protección.",
    )
  }

  try {
    assert.deepStrictEqual(actual.progress, expectedProgress)
  } catch (error) {
    console.error("[contract] El payload GEO de PROGRESO cambió respecto al contrato v1.")
    console.error("[contract] Si el cambio es intencional, revisa mapeos externos y actualiza snapshot con --update.")
    throw error
  }

  try {
    assert.deepStrictEqual(actual.complete, expectedComplete)
  } catch (error) {
    console.error("[contract] El payload GEO de COMPLETADO cambió respecto al contrato v1.")
    console.error("[contract] Si el cambio es intencional, revisa mapeos externos y actualiza snapshot con --update.")
    throw error
  }

  console.log("[contract] OK: contrato GEO payload v1 sin cambios.")
}

const main = async () => {
  const updateMode = process.argv.includes("--update")
  if (updateMode) {
    await writeSnapshots()
    console.log("[contract] Snapshots GEO actualizados.")
    return
  }
  await validateSnapshots()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
