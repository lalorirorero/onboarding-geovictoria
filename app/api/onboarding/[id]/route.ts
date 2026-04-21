import { type NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

type ConsentEvent = {
  subjectType: "empresa_representante" | "titular" | "partner_user"
  eventType:
    | "privacy_notice_shown"
    | "privacy_notice_accepted"
    | "representative_declaration_accepted"
    | "marketing_opt_in"
    | "marketing_opt_out"
  policyVersion: string
  legalTextHash: string | null
  source: string
  metadata: Record<string, unknown>
}

const VALID_CONSENT_SUBJECT_TYPES = new Set(["empresa_representante", "titular", "partner_user"])
const VALID_CONSENT_EVENT_TYPES = new Set([
  "privacy_notice_shown",
  "privacy_notice_accepted",
  "representative_declaration_accepted",
  "marketing_opt_in",
  "marketing_opt_out",
])

const toNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim()
}

const parseDateSafe = (value: unknown) => {
  if (!value) return null
  const dateValue = new Date(String(value))
  if (Number.isNaN(dateValue.getTime())) return null
  return dateValue
}

const getClientIp = (request: NextRequest) => {
  const candidates = [
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    request.headers.get("cf-connecting-ip"),
  ].filter(Boolean) as string[]

  if (candidates.length === 0) return null

  let ip = candidates[0].split(",")[0].trim()
  if (!ip) return null

  if (ip.includes(".") && ip.includes(":") && ip.indexOf(":") === ip.lastIndexOf(":")) {
    ip = ip.split(":")[0]
  }

  const ipv4Regex =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
  const looksLikeIpv6 = ip.includes(":")
  if (ipv4Regex.test(ip) || looksLikeIpv6) return ip
  return null
}

const isMissingSchemaObjectError = (error: any) => {
  const code = String(error?.code || "")
  const message = String(error?.message || "").toLowerCase()
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST202" ||
    message.includes("does not exist") ||
    message.includes("could not find")
  )
}

const getAdminClientOrNull = () => {
  return getSupabaseAdminClient()
}

const parseConsentEvent = (value: unknown): { event: ConsentEvent | null; error?: string } => {
  if (!value) return { event: null }
  if (typeof value !== "object") {
    return { event: null, error: "consentEvent debe ser un objeto." }
  }

  const raw = value as Record<string, unknown>
  const subjectType = toNonEmptyString(raw.subjectType || raw.subject_type) || "empresa_representante"
  const eventType = toNonEmptyString(raw.eventType || raw.event_type)
  const policyVersion = toNonEmptyString(raw.policyVersion || raw.policy_version)

  if (!VALID_CONSENT_SUBJECT_TYPES.has(subjectType)) {
    return { event: null, error: "consentEvent.subjectType no es válido." }
  }
  if (!VALID_CONSENT_EVENT_TYPES.has(eventType)) {
    return { event: null, error: "consentEvent.eventType no es válido." }
  }
  if (!policyVersion) {
    return { event: null, error: "consentEvent.policyVersion es obligatorio." }
  }

  const legalTextHash = toNonEmptyString(raw.legalTextHash || raw.legal_text_hash) || null
  const source = toNonEmptyString(raw.source) || "web"
  const metadata =
    raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {}

  return {
    event: {
      subjectType: subjectType as ConsentEvent["subjectType"],
      eventType: eventType as ConsentEvent["eventType"],
      policyVersion,
      legalTextHash,
      source,
      metadata,
    },
  }
}

const persistConsentEvent = async (params: {
  supabase: SupabaseClient
  onboardingId: string
  consentEvent: ConsentEvent
  ipAddress: string | null
  userAgent: string | null
}) => {
  const { supabase, onboardingId, consentEvent, ipAddress, userAgent } = params

  const updatePayload: Record<string, unknown> = {
    policy_version: consentEvent.policyVersion,
  }
  if (consentEvent.eventType === "privacy_notice_shown") {
    updatePayload.privacy_notice_shown_at = new Date().toISOString()
  }
  if (consentEvent.eventType === "privacy_notice_accepted") {
    updatePayload.privacy_notice_accepted_at = new Date().toISOString()
  }
  if (consentEvent.eventType === "representative_declaration_accepted") {
    updatePayload.representative_declaration_accepted = true
  }

  // Guardar primero en onboardings para asegurar version aceptada aun si falta la tabla de eventos.
  const { error: updateComplianceError } = await supabase.from("onboardings").update(updatePayload).eq("id", onboardingId)
  if (updateComplianceError && !isMissingSchemaObjectError(updateComplianceError)) {
    console.error("[v0] Error actualizando columnas de compliance en onboardings:", updateComplianceError)
  }

  const { error: consentInsertError } = await supabase.from("onboarding_consents").insert({
    onboarding_id: onboardingId,
    subject_type: consentEvent.subjectType,
    event_type: consentEvent.eventType,
    policy_version: consentEvent.policyVersion,
    legal_text_hash: consentEvent.legalTextHash,
    ip_address: ipAddress,
    user_agent: userAgent,
    source: consentEvent.source,
    metadata: consentEvent.metadata,
    created_at: new Date().toISOString(),
  })

  if (consentInsertError) {
    if (!isMissingSchemaObjectError(consentInsertError)) {
      console.error("[v0] Error insertando onboarding_consents:", consentInsertError)
    }
  }
}

// GET /api/onboarding/[id] - Obtener datos actuales del onboarding
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 })
    }

    console.log(`[v0] GET /api/onboarding/${id}`)

    const supabase = getAdminClientOrNull()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el servidor." },
        { status: 500 },
      )
    }
    const { data, error } = await supabase.from("onboardings").select("*").eq("id", id).single()

    if (error) {
      console.error("[v0] Error obteniendo onboarding:", error)
      return NextResponse.json({ success: false, error: "Onboarding no encontrado" }, { status: 404 })
    }

    if (data?.deleted_at || data?.anonymized_at) {
      return NextResponse.json(
        {
          success: false,
          error: "Este link de onboarding ya no está disponible.",
          code: "ONBOARDING_UNAVAILABLE",
        },
        { status: 410 },
      )
    }

    const tokenExpiresAt = parseDateSafe(data?.token_expires_at)
    if (tokenExpiresAt && tokenExpiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        {
          success: false,
          error: "Este link de onboarding expiró. Solicita uno nuevo a tu ejecutivo comercial.",
          code: "TOKEN_EXPIRED",
          tokenExpiresAt: tokenExpiresAt.toISOString(),
        },
        { status: 410 },
      )
    }

    const ipAddress = getClientIp(request)
    const userAgent = request.headers.get("user-agent")
    const { error: markAccessError } = await supabase.rpc("mark_onboarding_access", {
      p_onboarding_id: id,
      p_ip: ipAddress,
      p_user_agent: userAgent,
    })
    if (markAccessError && !isMissingSchemaObjectError(markAccessError)) {
      console.warn("[v0] mark_onboarding_access error (no bloqueante):", markAccessError)
    }

    const normalizedStatus = String(data?.estado || "").toLowerCase()
    const isCompleted = normalizedStatus === "completado"

    console.log(`[v0] Onboarding encontrado - Paso: ${data.ultimo_paso}`)

    return NextResponse.json({
      success: true,
      id_zoho: data.id_zoho ?? null,
      formData: data.datos_actuales,
      lastStep: isCompleted ? 11 : data.ultimo_paso,
      currentStep: data.ultimo_paso,
      navigationHistory: data.navigation_history,
      estado: data.estado,
      isLocked: isCompleted,
      tokenExpiresAt: tokenExpiresAt ? tokenExpiresAt.toISOString() : null,
      compliance: {
        policyVersion: data.policy_version || null,
        privacyNoticeShownAt: data.privacy_notice_shown_at || null,
        privacyNoticeAcceptedAt: data.privacy_notice_accepted_at || null,
        representativeDeclarationAccepted: Boolean(data.representative_declaration_accepted),
      },
    })
  } catch (error) {
    console.error("[v0] Error en GET /api/onboarding/[id]:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
}

// PATCH /api/onboarding/[id] - Actualizar datos del onboarding
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 })
    }

    const { formData, currentStep, navigationHistory, estado, fecha_completado } = body
    if (!formData || typeof currentStep !== "number") {
      return NextResponse.json({ success: false, error: "Datos inválidos" }, { status: 400 })
    }

    const consentEventResult = parseConsentEvent(body?.consentEvent)
    if (consentEventResult.error) {
      return NextResponse.json({ success: false, error: consentEventResult.error }, { status: 400 })
    }

    const supabase = getAdminClientOrNull()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el servidor." },
        { status: 500 },
      )
    }
    const { data: existingRow, error: existingError } = await supabase
      .from("onboardings")
      .select("datos_actuales, estado, ultimo_paso, navigation_history, token_expires_at, deleted_at, anonymized_at")
      .eq("id", id)
      .single()

    if (existingError) {
      console.error("[v0] Error obteniendo onboarding para merge:", existingError)
      return NextResponse.json({ success: false, error: "Onboarding no encontrado" }, { status: 404 })
    }

    if (existingRow?.deleted_at || existingRow?.anonymized_at) {
      return NextResponse.json({ success: false, error: "Onboarding no disponible" }, { status: 410 })
    }

    const tokenExpiresAt = parseDateSafe(existingRow?.token_expires_at)
    if (tokenExpiresAt && tokenExpiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { success: false, error: "Este link de onboarding expiró.", code: "TOKEN_EXPIRED" },
        { status: 410 },
      )
    }

    const isNonEmptyArray = (value: unknown): value is unknown[] => Array.isArray(value) && value.length > 0
    const shouldUseArray = (incoming: unknown, step: number, allowedSteps: number[]) => {
      if (isNonEmptyArray(incoming)) return true
      return Array.isArray(incoming) && allowedSteps.includes(step)
    }

    const mergeFormData = (existing: any, incoming: any, step: number) => {
      const mergedEmpresa = {
        ...(existing?.empresa || {}),
        ...(incoming?.empresa || {}),
      }

      if (shouldUseArray(incoming?.empresa?.grupos, step, [5])) {
        mergedEmpresa.grupos = incoming.empresa.grupos
      } else if (Array.isArray(existing?.empresa?.grupos)) {
        mergedEmpresa.grupos = existing.empresa.grupos
      }

      const merged = {
        ...existing,
        ...incoming,
        empresa: mergedEmpresa,
      }

      if (shouldUseArray(incoming?.admins, step, [3])) merged.admins = incoming.admins
      else if (Array.isArray(existing?.admins)) merged.admins = existing.admins

      if (shouldUseArray(incoming?.trabajadores, step, [5])) merged.trabajadores = incoming.trabajadores
      else if (Array.isArray(existing?.trabajadores)) merged.trabajadores = existing.trabajadores

      if (shouldUseArray(incoming?.turnos, step, [7])) merged.turnos = incoming.turnos
      else if (Array.isArray(existing?.turnos)) merged.turnos = existing.turnos

      if (shouldUseArray(incoming?.planificaciones, step, [8])) merged.planificaciones = incoming.planificaciones
      else if (Array.isArray(existing?.planificaciones)) merged.planificaciones = existing.planificaciones

      if (shouldUseArray(incoming?.asignaciones, step, [9])) merged.asignaciones = incoming.asignaciones
      else if (Array.isArray(existing?.asignaciones)) merged.asignaciones = existing.asignaciones

      if (incoming?.configureNow === undefined && existing?.configureNow !== undefined) {
        merged.configureNow = existing.configureNow
      }
      if (incoming?.loadWorkersNow === undefined && existing?.loadWorkersNow !== undefined) {
        merged.loadWorkersNow = existing.loadWorkersNow
      }

      return merged
    }

    const existingStatus = String(existingRow?.estado || "").toLowerCase()
    if (existingStatus === "completado") {
      console.log(`[v0] Onboarding ${id} bloqueado (Completado). Ignorando actualización.`)
      return NextResponse.json({ success: true, locked: true })
    }

    const existingStep = Number(existingRow?.ultimo_paso ?? 0)
    const incomingStep = Number(currentStep)
    const nextStep = Math.max(existingStep, incomingStep)
    if (incomingStep < existingStep) {
      console.log(
        `[v0] Onboarding ${id}: paso entrante ${incomingStep} menor que ultimo paso ${existingStep}. Conservando ultimo paso.`,
      )
    }

    const mergedFormData = mergeFormData(existingRow?.datos_actuales || {}, formData, currentStep)
    const existingHistory = Array.isArray(existingRow?.navigation_history) ? existingRow.navigation_history : []
    const incomingHistory = Array.isArray(navigationHistory) ? navigationHistory : []
    const nextHistory = incomingStep < existingStep && existingHistory.length > 0 ? existingHistory : incomingHistory

    const updateData: any = {
      datos_actuales: mergedFormData,
      ultimo_paso: nextStep,
      navigation_history: nextHistory,
      fecha_ultima_actualizacion: new Date().toISOString(),
    }

    if (estado && incomingStep >= existingStep) {
      updateData.estado = estado
    }
    if (fecha_completado) {
      updateData.fecha_completado = fecha_completado
    }
    if (!estado && nextStep > 0) {
      updateData.estado = "en_progreso"
    }

    const { error } = await supabase.from("onboardings").update(updateData).eq("id", id)
    if (error) {
      console.error("[v0] Error actualizando onboarding:", error)
      return NextResponse.json({ success: false, error: "Error al actualizar" }, { status: 500 })
    }

    console.log(`[v0] Onboarding ${id} actualizado - Paso: ${currentStep}`)

    try {
      const { error: historyError } = await supabase.from("onboarding_history").insert({
        onboarding_id: id,
        source: "api_onboarding_patch",
        event_type: "patch",
        current_step: currentStep,
        estado: estado || null,
        payload: body,
        created_at: new Date().toISOString(),
      })
      if (historyError) {
        console.error("[v0] Error insertando onboarding_history:", historyError)
      }
    } catch (historyInsertError) {
      console.error("[v0] Error inesperado insertando onboarding_history:", historyInsertError)
    }

    if (consentEventResult.event) {
      const ipAddress = getClientIp(request)
      const userAgent = request.headers.get("user-agent")
      await persistConsentEvent({
        supabase,
        onboardingId: id,
        consentEvent: consentEventResult.event,
        ipAddress,
        userAgent,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error en PATCH /api/onboarding/[id]:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
}
