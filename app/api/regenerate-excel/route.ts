import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"
import ExcelJS from "exceljs"
import path from "path"
import { NextResponse } from "next/server"

const STORAGE_BUCKET = "onboarding-excels"
const SIGNED_URL_TTL_SECONDS = 30 * 24 * 60 * 60

const sanitizeRut = (rut: string) => (rut || "sin-rut").replace(/\./g, "").replace(/-/g, "").trim() || "sin-rut"
const normalizeRutForExcel = (rut: string) => (rut || "").replace(/[^0-9A-Za-z]/g, "").toUpperCase()

const formatTimestamp = () => {
  const now = new Date()
  const pad = (v: number) => String(v).padStart(2, "0")
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

const splitNombre = (nombreCompleto: string) => {
  const trimmed = (nombreCompleto || "").trim()
  if (!trimmed) return { nombres: "", apellidos: "" }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { nombres: parts[0], apellidos: "" }
  return { nombres: parts.slice(0, -1).join(" "), apellidos: parts.slice(-1).join(" ") }
}

const pickPhone = (trabajador: any, index: number) => {
  const direct = trabajador?.[`telefono${index}`] || trabajador?.[`telefono_${index}`]
  if (direct) return direct
  if (Array.isArray(trabajador?.telefonos)) {
    const fromArray = trabajador.telefonos[index - 1]
    if (fromArray) return fromArray
  }
  if (index === 1) return trabajador?.telefono || trabajador?.telefonoContacto || ""
  return ""
}

const setExcelCell = (sheet: any, cellAddress: string, value: any) => {
  if (value === undefined || value === null || value === "") return
  sheet.getCell(cellAddress).value = value
}

function buildUsuariosWorkbook(datos: any) {
  const empresa = datos.empresa || {}
  const admins = Array.isArray(datos.admins) ? datos.admins : []
  const trabajadores = Array.isArray(datos.trabajadores) ? datos.trabajadores : []
  const empresaRut = normalizeRutForExcel(empresa.rut)

  const headers = [
    "identificador", "email", "email alternativo comprobantes",
    "nombre", "apellido", "grupo", "fono1", "fono2", "fono3",
    "identificador razon social", "tipo",
  ]

  const adminsRows = admins.map((admin: any) => [
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
  ])

  const trabajadoresRows = trabajadores.map((t: any) => {
    const { nombres, apellidos } = splitNombre(t?.nombre)
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
    ]
  })

  const rows = [...adminsRows, ...trabajadoresRows]
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, "Usuarios")
  return wb
}

async function buildPlanificacionWorkbook(datos: any) {
  const empresa = datos.empresa || {}
  const admins = Array.isArray(datos.admins) ? datos.admins : []
  const trabajadores = Array.isArray(datos.trabajadores) ? datos.trabajadores : []
  const turnos = Array.isArray(datos.turnos) ? datos.turnos : []
  const planificaciones = Array.isArray(datos.planificaciones) ? datos.planificaciones : []
  const asignaciones = Array.isArray(datos.asignaciones) ? datos.asignaciones : []

  const templatePath = path.join(process.cwd(), "assets", "templates", "PLANTILLA_INGRESO.xlsx")

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(templatePath)
  const sheet = wb.getWorksheet("Trabajadores")
  if (!sheet) throw new Error("No se encontro la hoja 'Trabajadores' en la plantilla.")

  setExcelCell(sheet, "C7", empresa.razonSocial || "")
  setExcelCell(sheet, "C8", empresa.nombreFantasia || "")
  setExcelCell(sheet, "C9", empresa.rut || "")
  setExcelCell(sheet, "C10", empresa.giro || "")
  setExcelCell(sheet, "C11", empresa.direccion || "")
  setExcelCell(sheet, "C12", empresa.comuna || "")
  setExcelCell(sheet, "C13", empresa.emailFacturacion || "")
  setExcelCell(sheet, "C14", empresa.telefonoContacto || "")
  setExcelCell(sheet, "C15", Array.isArray(empresa.sistema) ? empresa.sistema.join(", ") : empresa.sistema || "")
  setExcelCell(sheet, "C16", empresa.rubro || "")

  const workerHeaderRowIndex = 25
  const adminBlockStartRow = 18
  const adminBlockHeight = 5
  const adminSpacerRows = 1
  const cloneStyle = (style: any) => style ? JSON.parse(JSON.stringify(style)) : undefined
  const adminCount = admins.length > 0 ? admins.length : 1

  if (adminCount > 1) {
    const merges = ((sheet as any)._merges && Object.keys((sheet as any)._merges)) || []
    const baseMergeRanges = merges
      .map((range: string) => {
        const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
        if (!match) return null
        const startRow = Number(match[2])
        const endRow = Number(match[4])
        if (startRow >= adminBlockStartRow && endRow <= adminBlockStartRow + adminBlockHeight - 1) {
          return { range, startRow, endRow }
        }
        return null
      })
      .filter(Boolean) as any[]

    for (let i = 1; i < adminCount; i++) {
      const insertRow = adminBlockStartRow + i * (adminBlockHeight + adminSpacerRows)
      sheet.spliceRows(insertRow, 0, ...Array(adminBlockHeight + adminSpacerRows).fill([]))

      for (let rowOffset = 0; rowOffset < adminBlockHeight; rowOffset++) {
        const sourceRow = sheet.getRow(adminBlockStartRow + rowOffset)
        const targetRow = sheet.getRow(insertRow + rowOffset)
        targetRow.height = sourceRow.height
        sourceRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const targetCell = targetRow.getCell(colNumber)
          targetCell.style = cloneStyle(cell.style) || {}
          if (colNumber === 2) {
            targetCell.value = cell.value
          } else {
            targetCell.value = null
          }
        })
      }

      baseMergeRanges.forEach((merge: any) => {
        const rowOffset = insertRow - adminBlockStartRow
        const range = merge.range.replace(/(\d+)/g, (match: string) => String(Number(match) + rowOffset))
        try { sheet.mergeCells(range) } catch (e) { /* ignore */ }
      })
    }
  }

  for (let i = 0; i < adminCount; i++) {
    const admin = admins[i] || null
    const blockStartRow = adminBlockStartRow + i * (adminBlockHeight + adminSpacerRows)
    const adminNombre = admin ? [admin?.nombre, admin?.apellido].filter(Boolean).join(" ") : "Sin administradores"
    setExcelCell(sheet, `B${blockStartRow}`, `Datos Administrador ${i + 1} del Sistema`)
    setExcelCell(sheet, `C${blockStartRow + 1}`, adminNombre)
    setExcelCell(sheet, `C${blockStartRow + 2}`, admin?.rut || "")
    setExcelCell(sheet, `C${blockStartRow + 3}`, admin?.telefono || "")
    setExcelCell(sheet, `C${blockStartRow + 4}`, admin?.email || "")
  }

  const insertedRows = (adminCount - 1) * (adminBlockHeight + adminSpacerRows)
  const newWorkerHeaderRowIndex = workerHeaderRowIndex + insertedRows

  const phoneColumns = [30, 31, 32]
  phoneColumns.forEach((col) => {
    const column = sheet.getColumn(col)
    if (!column.width || column.width < 16) column.width = 16
  })

  const findTurno = (turnoId: any) => turnos.find((turno: any) => String(turno.id) === String(turnoId))
  const hasLibre = (turno: any) => {
    const nombre = String(turno?.nombre || "").toLowerCase()
    return nombre.includes("libre") || nombre.includes("descanso")
  }
  const findAsignacion = (trabajadorId: any) =>
    asignaciones.find(
      (asig: any) => String(asig.trabajadorId) === String(trabajadorId) && asig.planificacionId && asig.desde && asig.hasta
    )

  const startRow = newWorkerHeaderRowIndex + 1
  trabajadores.forEach((trabajador: any, index: number) => {
    const rowIndex = startRow + index
    const { nombres, apellidos } = splitNombre(trabajador?.nombre)
    const grupo = trabajador?.grupoNombre || trabajador?.grupo || ""
    const asignacion = findAsignacion(trabajador?.id)
    const plan = planificaciones.find((p: any) => String(p.id) === String(asignacion?.planificacionId))
    const fechaInicio = asignacion?.desde || ""
    const fechaFin = asignacion?.hasta === "permanente" ? "PERMANENTE" : asignacion?.hasta || ""

    const rowValues: any[] = [
      trabajador?.rut || "",
      trabajador?.correo || "",
      nombres,
      apellidos,
      grupo,
      fechaInicio,
      fechaFin,
    ]

    const diasTurnos = Array.isArray(plan?.diasTurnos) ? plan.diasTurnos : Array(7).fill(null)
    diasTurnos.forEach((turnoId: any) => {
      const turno = findTurno(turnoId)
      if (!turno || hasLibre(turno)) {
        rowValues.push("", "", "")
        return
      }
      let colacionValue = ""
      if (turno?.tipoColacion) {
        const tipo = turno.tipoColacion.toLowerCase()
        if (tipo === "sin") colacionValue = "Sin Colacion"
        else if (tipo === "libre") colacionValue = turno.colacionMinutos ? `${turno.colacionMinutos} min libre` : "Colacion libre"
        else if (tipo === "fija") colacionValue = turno.colacionInicio && turno.colacionFin ? `${turno.colacionInicio} - ${turno.colacionFin}` : "Colacion fija"
      } else {
        colacionValue = turno.colacionMinutos || ""
      }
      rowValues.push(turno.horaInicio || "", colacionValue, turno.horaFin || "")
    })

    const row = sheet.getRow(rowIndex)
    rowValues.forEach((value, valueIndex) => {
      if (value === undefined || value === null || value === "") return
      row.getCell(2 + valueIndex).value = value
    })
    phoneColumns.forEach((col, idx) => {
      const phoneValue = pickPhone(trabajador, idx + 1)
      if (phoneValue) row.getCell(col).value = phoneValue
    })
  })

  return wb
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ 
        error: "Token requerido", 
        ejemplo: { token: "47cc61fe-98da-4b24-8307-0cc7f769fb72" }
      }, { status: 400 })
    }

    const supabaseUrl = process.env.SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

    // 1. Get data
    const { data: record, error: fetchError } = await supabase
      .from("onboardings")
      .select("*")
      .eq("id", token)
      .single()

    if (fetchError || !record) {
      return NextResponse.json({ error: "Registro no encontrado", token, details: fetchError }, { status: 404 })
    }

    const datos = record.datos_actuales
    const empresa = datos.empresa || {}
    const rutKey = sanitizeRut(empresa.rut)
    const timestamp = formatTimestamp()

    // 2. Generate Usuarios Excel
    const usuariosWorkbook = buildUsuariosWorkbook(datos)
    const usuariosBuffer = XLSX.write(usuariosWorkbook, { type: "buffer", bookType: "xlsx" })

    // 3. Generate Planificaciones Excel (with template)
    const planificacionesWorkbook = await buildPlanificacionWorkbook(datos)
    const planificacionesBuffer = Buffer.from(await planificacionesWorkbook.xlsx.writeBuffer())

    // 4. Upload to Storage
    const usuariosFilename = `usuarios-${rutKey}-${timestamp}.xlsx`
    const planificacionesFilename = `planificaciones-${rutKey}-${timestamp}.xlsx`
    const usuariosPath = `onboarding/${rutKey}/${usuariosFilename}`
    const planificacionesPath = `onboarding/${rutKey}/${planificacionesFilename}`
    const uploadOptions = {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    }

    const { error: err1 } = await supabase.storage.from(STORAGE_BUCKET).upload(usuariosPath, usuariosBuffer, uploadOptions)
    if (err1) return NextResponse.json({ error: "Error subiendo usuarios", details: err1 }, { status: 500 })

    const { error: err2 } = await supabase.storage.from(STORAGE_BUCKET).upload(planificacionesPath, planificacionesBuffer, uploadOptions)
    if (err2) return NextResponse.json({ error: "Error subiendo planificaciones", details: err2 }, { status: 500 })

    // 5. Generate Signed URLs
    const { data: sig1, error: sigErr1 } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(usuariosPath, SIGNED_URL_TTL_SECONDS)
    if (sigErr1) return NextResponse.json({ error: "Error signed URL usuarios", details: sigErr1 }, { status: 500 })

    const { data: sig2, error: sigErr2 } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(planificacionesPath, SIGNED_URL_TTL_SECONDS)
    if (sigErr2) return NextResponse.json({ error: "Error signed URL planificaciones", details: sigErr2 }, { status: 500 })

    const urlUsuarios = sig1.signedUrl
    const urlPlanificaciones = sig2.signedUrl

    // 6. Update DB
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString()
    const mergedDatos = {
      ...datos,
      excelUrls: {
        usuarios: { filename: usuariosFilename, url: urlUsuarios },
        planificaciones: { filename: planificacionesFilename, url: urlPlanificaciones },
      },
      excelUrlUsuarios: urlUsuarios,
      excelUrlPlanificaciones: urlPlanificaciones,
    }

    const { error: updateError } = await supabase
      .from("onboardings")
      .update({
        datos_actuales: mergedDatos,
        fecha_ultima_actualizacion: new Date().toISOString(),
      })
      .eq("id", token)

    return NextResponse.json({
      success: true,
      token,
      empresa: empresa.razonSocial,
      rut: empresa.rut,
      admins: Array.isArray(datos.admins) ? datos.admins.length : 0,
      trabajadores: Array.isArray(datos.trabajadores) ? datos.trabajadores.length : 0,
      urlUsuarios,
      urlPlanificaciones,
      expiresAt,
      dbUpdated: !updateError,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "API para regenerar Excel de onboarding",
    metodo: "POST",
    endpoint: "/api/regenerate-excel",
    body: {
      token: "UUID del onboarding (ej: 47cc61fe-98da-4b24-8307-0cc7f769fb72)"
    },
    ejemplo_curl: `curl -X POST https://tu-dominio.vercel.app/api/regenerate-excel -H "Content-Type: application/json" -d '{"token":"47cc61fe-98da-4b24-8307-0cc7f769fb72"}'`
  })
}
