# ANÁLISIS COMPLETO: FLUJO DE DATOS Y RIESGOS DEL SISTEMA ACTUAL

**Fecha:** Diciembre 2024  
**Propósito:** Identificar riesgos antes de implementar persistencia con base de datos

---

## 1. ARQUITECTURA ACTUAL

### 1.1 Componentes del Sistema

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                     CRM (ZOHO)                               │
│  - Genera datos de empresa                                   │
│  - Llama a /api/generate-link                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          /api/generate-link (Backend)                        │
│  - Recibe datos de empresa                                   │
│  - Encripta TODOS los datos en el token                     │
│  - Devuelve link con token                                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          Usuario abre link (?token=...)                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│    components/onboarding-turnos.tsx (Frontend)              │
│  1. useEffect inicial detecta token                          │
│  2. Llama a fetchTokenData()                                 │
│  3. fetchTokenData() → /api/decrypt-token                    │
│  4. Carga datos en formData (estado local)                   │
│  5. Usuario completa formulario                              │
│  6. Datos viven SOLO en memoria (useState)                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Navegación entre pasos                          │
│  - handleNext() - Avanza al siguiente paso                   │
│  - handlePrev() - Retrocede al paso anterior                 │
│  - handleWorkersDecision() - Salta paso 5                    │
│  - handleConfigurationDecision() - Salta pasos 7-9          │
│  - sendProgressWebhook() - Envía progreso a Zoho            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          handleFinalizar() (Envío final)                     │
│  1. Construye ZohoPayload con formData completo              │
│  2. Navega a paso 11 (Agradecimiento)                       │
│  3. Envía a /api/submit-to-zoho (fire-and-forget)           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          /api/submit-to-zoho (Backend)                       │
│  1. Recibe ZohoPayload                                       │
│  2. Genera Excel desde formData                              │
│  3. Envía webhook a Zoho Flow                                │
└─────────────────────────────────────────────────────────────┘
\`\`\`

---

## 2. FLUJO DETALLADO DE DATOS

### 2.1 FASE 1: Generación del Link (CRM → Backend)

**API:** `POST /api/generate-link`

**Input desde CRM:**
\`\`\`json
{
  "id_zoho": "123456789",
  "empresa": {
    "razonSocial": "Empresa X S.A.",
    "nombreFantasia": "Empresa X",
    "rut": "12345678-9",
    "giro": "Comercio",
    "direccion": "Calle 123",
    "comuna": "Santiago",
    "emailFacturacion": "facturacion@empresax.cl",
    "telefonoContacto": "+56912345678",
    "sistema": ["Turno Fijo"],
    "rubro": "Retail"
  }
}
\`\`\`

**Proceso:**
1. Valida que exista campo `empresa`
2. Extrae `id_zoho` y lo convierte a string
3. Construye objeto `dataToEncrypt` con estructura completa:
   \`\`\`json
   {
     "id_zoho": "123456789",
     "razonSocial": "Empresa X S.A.",
     "nombreFantasia": "Empresa X",
     "rut": "12345678-9",
     // ... todos los campos de empresa
     "admins": [],          // Vacío
     "trabajadores": [],    // Vacío
     "turnos": [],          // Vacío
     "planificaciones": [], // Vacío
     "asignaciones": []     // Vacío
   }
   \`\`\`
4. Encripta TODO el objeto con AES-GCM-256
5. Genera token base64 URL-safe
6. Devuelve link: `https://app.com?token=XXXXXXXXXXXX`

**Output:**
\`\`\`json
{
  "success": true,
  "link": "https://app.com?token=XXXXXXXXXXXX",
  "token": "XXXXXXXXXXXX"
}
\`\`\`

**⚠️ PROBLEMA ACTUAL:**
- Token contiene TODOS los datos encriptados (puede ser muy grande)
- Si CRM envía datos y luego los modifica, el token queda desactualizado
- No hay persistencia: si usuario cierra navegador, pierde todo

---

### 2.2 FASE 2: Apertura del Link (Usuario → Frontend)

**Trigger:** Usuario abre `https://app.com?token=XXXXXXXXXXXX`

**Proceso en `useEffect` inicial:**

\`\`\`typescript
useEffect(() => {
  const initializeData = async () => {
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get("token")
    
    if (token) {
      // 1. Llamar a fetchTokenData
      const tokenData = await fetchTokenData(token)
      
      if (tokenData) {
        // 2. Extraer id_zoho
        const currentIdZoho = tokenData.empresa?.id_zoho
        setIdZoho(currentIdZoho)
        setHasToken(true)
        
        // 3. Cargar datos prellenados
        loadDataFromPrefill(tokenData)
      }
    }
    
    setCurrentStep(PRIMER_PASO) // Paso 0
    setIsInitialized(true)
  }
  
  initializeData()
}, [])
\`\`\`

**Función `fetchTokenData(token)`:**

\`\`\`typescript
const fetchTokenData = async (token: string) => {
  // 1. Llamar a API decrypt-token
  const response = await fetch("/api/decrypt-token", {
    method: "POST",
    body: JSON.stringify({ token })
  })
  
  const result = await response.json()
  
  if (!result.success || !result.empresaData) {
    return null
  }
  
  // 2. Formatear datos para OnboardingFormData
  return {
    empresa: {
      razonSocial: result.empresaData.razonSocial || "",
      nombreFantasia: result.empresaData.nombreFantasia || "",
      rut: result.empresaData.rut || "",
      // ... todos los campos
      id_zoho: result.empresaData.id_zoho || null
    },
    admins: result.empresaData.admins || [],
    trabajadores: result.empresaData.trabajadores || [],
    turnos: result.empresaData.turnos || [],
    planificaciones: result.empresaData.planificaciones || [],
    asignaciones: result.empresaData.asignaciones || []
  }
}
\`\`\`

**API:** `POST /api/decrypt-token`

**Proceso:**
1. Recibe token encriptado
2. Desencripta con AES-GCM-256
3. Parsea JSON
4. Devuelve `empresaData`

**Estado después de carga:**
\`\`\`typescript
formData = {
  empresa: {
    razonSocial: "Empresa X S.A.",  // ← Prellenado
    nombreFantasia: "Empresa X",    // ← Prellenado
    rut: "12345678-9",              // ← Prellenado
    // ... campos prellenados
    id_zoho: "123456789"            // ← Prellenado
  },
  admins: [],              // Vacío (usuario debe llenar)
  trabajadores: [],        // Vacío
  turnos: DEFAULT_TURNOS,  // Predefinidos
  planificaciones: [],     // Vacío
  asignaciones: [],        // Vacío
  configureNow: true       // Default
}

hasToken = true
idZoho = "123456789"
currentStep = 0
prefilledFields = Set(['empresa.razonSocial', 'empresa.rut', ...])
\`\`\`

**⚠️ RIESGO IDENTIFICADO #1:**
- Todos los datos viven SOLO en memoria (useState)
- Si usuario cierra navegador → PIERDE TODO
- Si recarga página → PIERDE TODO
- No hay respaldo ni auto-save

---

### 2.3 FASE 3: Navegación entre Pasos

#### 2.3.1 Avanzar al Siguiente Paso

**Función:** `handleNext()`

**Proceso:**
\`\`\`typescript
const handleNext = useCallback(() => {
  // 1. Limpiar errores previos
  setFieldErrors({})
  setNoAdminsError(false)
  
  // 2. Validar según paso actual
  if (currentStep === 2) {
    // Validar campos de empresa
    const validation = validateEmpresaFields(formData.empresa)
    if (!validation.isValid) {
      // Mostrar errores y DETENER
      setFieldErrors(errors)
      toast({ ... })
      return // ← NO AVANZA
    }
  } else if (currentStep === 3) {
    // Validar que haya al menos 1 admin
    const validation = validateAdminsFields(formData.admins)
    if (!validation.isValid) {
      setNoAdminsError(true)
      toast({ ... })
      return // ← NO AVANZA
    }
  }
  // ... otras validaciones
  
  // 3. Calcular siguiente paso
  const nextStep = currentStep + 1
  
  // 4. Enviar webhook de progreso (fire-and-forget)
  sendProgressWebhook({
    pasoActual: currentStep,
    pasoNombre: steps[currentStep]?.label,
    totalPasos: steps.length,
    empresaRut: formData.empresa.rut,
    empresaNombre: formData.empresa.razonSocial,
    idZoho: idZoho
  })
  
  // 5. Actualizar estado
  setCurrentStep(nextStep)
  setCompletedSteps(prev => [...new Set([...prev, currentStep])])
  
  window.scrollTo({ top: 0, behavior: "smooth" })
}, [currentStep, formData, idZoho, ...])
\`\`\`

**⚠️ RIESGO IDENTIFICADO #2:**
- `sendProgressWebhook()` usa `formData` de las dependencias del callback
- Si `formData` está desactualizado en las dependencias → envía datos viejos
- Puede enviar `admins: []` cuando ya se agregó un admin

**Estado de formData capturado:**
\`\`\`typescript
// Si callback se creó cuando formData.admins = []
// Pero ahora formData.admins = [admin1]
// El callback TODAVÍA tiene admins = [] en su closure
sendProgressWebhook({ 
  formData: { admins: [] }  // ← DATOS VIEJOS
})
\`\`\`

---

#### 2.3.2 Retroceder al Paso Anterior

**Función:** `handlePrev()`

**Proceso:**
\`\`\`typescript
const handlePrev = useCallback(() => {
  const prevStep = currentStep - 1
  
  if (prevStep >= 0) {
    // 1. Enviar webhook de progreso
    sendProgressWebhook({
      pasoActual: prevStep,
      pasoNombre: steps[prevStep]?.label,
      totalPasos: steps.length,
      empresaRut: formData.empresa.rut,
      empresaNombre: formData.empresa.razonSocial,
      idZoho: idZoho
    })
    
    // 2. Actualizar paso
    setCurrentStep(prevStep)
  }
}, [currentStep, formData.empresa, idZoho, ...])
\`\`\`

**⚠️ RIESGO IDENTIFICADO #3:**
- Mismo problema: `formData` puede estar desactualizado en el closure
- Si usuario agregó admin en paso 3 y retrocede, webhook puede enviar `admins: []`

**Problema de navegación con saltos:**
\`\`\`
Flujo del usuario:
Paso 0 → 1 → 2 → 3 → 4 (elige "En capacitación") → Paso 6

Usuario está en paso 6 y presiona "Atrás"
handlePrev() calcula: prevStep = 6 - 1 = 5
Usuario va a paso 5 (TrabajadoresStep) ❌

PROBLEMA: Usuario NUNCA vio el paso 5, debería volver al paso 4
\`\`\`

---

#### 2.3.3 Decisión de Trabajadores

**Función:** `handleWorkersDecision(decision)`

**Proceso:**
\`\`\`typescript
const handleWorkersDecision = useCallback((decision: "now" | "later") => {
  // 1. Actualizar formData
  setFormData(prev => ({ ...prev, loadWorkersNow: decision === "now" }))
  
  // 2. Decidir siguiente paso
  if (decision === "now") {
    handleNext() // → Paso 5 (TrabajadoresStep)
  } else {
    // Saltar al paso 6 (DecisionStep para turnos)
    setCurrentStep(6)
    setCompletedSteps(prev => [...new Set([...prev, currentStep])])
  }
}, [handleNext, setCurrentStep, currentStep])
\`\`\`

**Flujo:**
- Usuario en paso 4
- Elige "En capacitación" → `decision = "later"`
- `loadWorkersNow = false`
- Salta de paso 4 → paso 6 (omite paso 5)

**⚠️ RIESGO IDENTIFICADO #4:**
- No hay historial de navegación
- Si usuario retrocede desde paso 6, va a paso 5 (que nunca vio)
- Debería volver a paso 4

---

#### 2.3.4 Decisión de Turnos

**Función:** `handleConfigurationDecision(decision)`

**Proceso:**
\`\`\`typescript
const handleConfigurationDecision = useCallback((decision: "now" | "later") => {
  // 1. Actualizar formData
  setFormData(prev => ({ ...prev, configureNow: decision === "now" }))
  
  // 2. Decidir siguiente paso
  if (decision === "now") {
    handleNext() // → Paso 7 (TurnosStep)
  } else {
    // Saltar al paso 10 (ResumenStep)
    setCurrentStep(10)
    setCompletedSteps(prev => [...new Set([...prev, currentStep])])
  }
}, [handleNext, setCurrentStep, currentStep])
\`\`\`

**Flujo:**
- Usuario en paso 6
- Elige "En capacitación" → `decision = "later"`
- `configureNow = false`
- Salta de paso 6 → paso 10 (omite pasos 7, 8, 9)

**⚠️ RIESGO IDENTIFICADO #5:**
- Mismo problema: sin historial de navegación
- Si usuario retrocede desde paso 10, va a paso 9 (que nunca vio)
- Debería volver a paso 6

---

### 2.4 FASE 4: Envío de Webhooks de Progreso

**Función:** `sendProgressWebhook(params)`

**Trigger:**
- Al avanzar paso (`handleNext`)
- Al retroceder paso (`handlePrev`)

**Proceso:**
\`\`\`typescript
export async function sendProgressWebhook(params) {
  console.log("[v0] sendProgressWebhook: INICIO", params)
  
  // 1. Validar que haya id_zoho
  if (!params.idZoho) {
    console.log("[v0] sendProgressWebhook: SKIPPED - No hay id_zoho")
    return
  }
  
  // 2. Saltar paso 0 (Bienvenida)
  if (params.pasoActual === 0) {
    console.log("[v0] sendProgressWebhook: SKIPPED - Paso 0")
    return
  }
  
  // 3. Construir payload
  const payload: ZohoPayload = {
    accion: "progreso",
    fechaHoraEnvio: new Date().toISOString(),
    eventType: "progress",
    id_zoho: params.idZoho,
    formData: {
      empresa: {
        id_zoho: params.idZoho,
        razonSocial: "",     // ← VACÍO
        nombreFantasia: "",  // ← VACÍO
        rut: params.empresaRut,
        // ... otros campos vacíos
      },
      admins: [],           // ← VACÍO
      trabajadores: [],     // ← VACÍO
      turnos: [],           // ← VACÍO
      planificaciones: [],  // ← VACÍO
      asignaciones: [],     // ← VACÍO
      configureNow: false
    },
    metadata: {
      empresaRut: params.empresaRut,
      empresaNombre: params.empresaNombre,
      pasoActual: params.pasoActual,
      pasoNombre: params.pasoNombre,
      totalPasos: params.totalPasos,
      porcentajeProgreso: Math.round((params.pasoActual / params.totalPasos) * 100)
    },
    excelFile: null
  }
  
  // 4. Enviar (fire-and-forget)
  try {
    const response = await fetch("/api/submit-to-zoho", {
      method: "POST",
      body: JSON.stringify(payload)
    })
    
    const result = await response.json()
    
    if (result.success) {
      console.log("[v0] sendProgressWebhook: ✅ ÉXITO")
    } else {
      console.warn("[v0] sendProgressWebhook: ⚠️ ERROR (no bloqueante)")
    }
  } catch (error) {
    console.warn("[v0] sendProgressWebhook: ⚠️ ERROR (no bloqueante)")
    // NO se lanza error, es fire-and-forget
  }
}
\`\`\`

**⚠️ RIESGO IDENTIFICADO #6:**
- Webhook de progreso NO envía el `formData` actual del usuario
- Solo envía metadata del paso
- Zoho Flow recibe arrays vacíos en `formData`
- No puede ver el progreso real del usuario

**Ejemplo:**
\`\`\`
Usuario completa empresa (paso 2) y avanza a paso 3
Webhook enviado:
{
  "formData": {
    "empresa": { "razonSocial": "" },  // ← VACÍO, debería tener "Empresa X"
    "admins": []
  },
  "metadata": {
    "pasoActual": 2,
    "pasoNombre": "Datos de Empresa",
    "porcentajeProgreso": 20
  }
}
\`\`\`

---

### 2.5 FASE 5: Finalización del Onboarding

**Función:** `handleFinalizar()`

**Trigger:** Usuario hace clic en "Confirmar y Enviar" (paso 10)

**Proceso:**
\`\`\`typescript
const handleFinalizar = useCallback(async () => {
  setIsSubmitting(true)
  
  // 1. Construir payload completo
  const payload: ZohoPayload = {
    accion: "completado",
    fechaHoraEnvio: new Date().toISOString(),
    eventType: "complete",
    id_zoho: idZoho,
    formData: {
      empresa: {
        id_zoho: idZoho,
        razonSocial: formData.empresa.razonSocial || "",
        nombreFantasia: formData.empresa.nombreFantasia || "",
        rut: formData.empresa.rut || "",
        giro: formData.empresa.giro || "",
        direccion: formData.empresa.direccion || "",
        comuna: formData.empresa.comuna || "",
        emailFacturacion: formData.empresa.emailFacturacion || "",
        telefonoContacto: formData.empresa.telefonoContacto || "",
        sistema: formData.empresa.sistema || [],
        rubro: formData.empresa.rubro || ""
      },
      admins: formData.admins || [],
      trabajadores: formData.trabajadores || [],
      turnos: formData.turnos || [],
      planificaciones: formData.planificaciones || [],
      asignaciones: formData.asignaciones || [],
      configureNow: formData.configureNow || false,
      loadWorkersNow: formData.loadWorkersNow || false
    },
    metadata: {
      empresaRut: formData.empresa.rut || "",
      empresaNombre: formData.empresa.razonSocial || formData.empresa.nombreFantasia || "",
      pasoActual: 10,
      pasoNombre: "Completado",
      totalPasos: steps.length,
      porcentajeProgreso: 100
    },
    excelFile: null
  }
  
  // 2. Navegar a página de agradecimiento INMEDIATAMENTE
  setCurrentStep(11)
  setIsSubmitting(false)
  
  // 3. Enviar a Zoho (fire-and-forget, NO espera respuesta)
  try {
    const response = await fetch("/api/submit-to-zoho", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    
    const result = await response.json()
    console.log("[v0] Resultado del envío a Zoho:", result)
  } catch (error) {
    console.error("[v0] Error al enviar a Zoho (silencioso):", error)
    // NO bloquea, usuario ya está en página de agradecimiento
  }
}, [formData, idZoho, steps.length])
\`\`\`

**⚠️ RIESGO IDENTIFICADO #7:**
- `handleFinalizar` usa `formData` del closure del callback
- Si `formData` está desactualizado, envía datos viejos
- Usuario puede ver página de agradecimiento pero datos incompletos se enviaron

**Ejemplo:**
\`\`\`
Usuario agrega admin en paso 3 → formData.admins = [admin1]
Callback handleFinalizar se crea con formData.admins = [admin1]

Usuario edita admin → formData.admins = [admin1_editado]
Callback handleFinalizar TODAVÍA tiene formData.admins = [admin1]

Usuario hace clic en "Finalizar"
Se envía: formData.admins = [admin1]  // ← DATOS VIEJOS
\`\`\`

---

### 2.6 FASE 6: Generación y Envío de Excel

**API:** `POST /api/submit-to-zoho`

**Proceso:**
\`\`\`typescript
export async function POST(request: NextRequest) {
  try {
    const payload: ZohoPayload = await request.json()
    
    // 1. Validar si es evento "complete" y hay datos de empresa
    if (
      payload.eventType === "complete" &&
      payload.formData?.empresa?.razonSocial &&
      payload.formData.empresa.razonSocial.trim() !== ""
    ) {
      // 2. Generar Excel
      const workbook = XLSX.utils.book_new()
      
      // Hoja 1: Empresa
      const empresaSheet = XLSX.utils.json_to_sheet([payload.formData.empresa])
      XLSX.utils.book_append_sheet(workbook, empresaSheet, "Empresa")
      
      // Hoja 2: Administradores
      const adminsSheet = XLSX.utils.json_to_sheet(
        payload.formData.admins.length > 0 
          ? payload.formData.admins 
          : [{ mensaje: "Sin administradores" }]
      )
      XLSX.utils.book_append_sheet(workbook, adminsSheet, "Administradores")
      
      // Hojas 3-6: Trabajadores, Turnos, Planificaciones, Asignaciones
      // ... similar ...
      
      // 3. Convertir a base64
      const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
      const base64 = Buffer.from(excelBuffer).toString("base64")
      
      // 4. Agregar Excel al payload
      payload.excelFile = {
        filename: `onboarding-${payload.formData.empresa.rut.replace(/\./g, "").replace(/-/g, "")}.xlsx`,
        base64: base64,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
    }
    
    // 5. Enviar a Zoho Flow
    const result = await sendToZohoFlow(payload)
    
    return NextResponse.json(result, {
      status: result.success ? 200 : 500
    })
  } catch (error) {
    console.error("[v0] /api/submit-to-zoho: ERROR:", error)
    return NextResponse.json({ success: false, error: ... }, { status: 500 })
  }
}
\`\`\`

**⚠️ RIESGO IDENTIFICADO #8:**
- Excel solo se genera para `eventType === "complete"`
- Webhooks de progreso NO tienen Excel
- Zoho no puede ver avance del usuario en formato descargable

---

## 3. RESUMEN DE RIESGOS IDENTIFICADOS

### 3.1 Pérdida de Datos

| # | Riesgo | Severidad | Impacto |
|---|--------|-----------|---------|
| 1 | Usuario cierra navegador → pierde todo | 🔴 CRÍTICO | Pérdida total de progreso |
| 2 | Usuario recarga página → pierde todo | 🔴 CRÍTICO | Pérdida total de progreso |
| 3 | No hay auto-save | 🔴 CRÍTICO | Pérdida ante fallos |
| 4 | formData desactualizado en callbacks | 🟠 ALTO | Envía datos viejos a Zoho |
| 5 | Race condition en handleFinalizar | 🟠 ALTO | Excel con datos incompletos |

### 3.2 Navegación

| # | Riesgo | Severidad | Impacto |
|---|--------|-----------|---------|
| 6 | Botón "Atrás" sin historial | 🟡 MEDIO | Usuario ve pasos que no visitó |
| 7 | handlePrev calcula prevStep - 1 | 🟡 MEDIO | Navegación incorrecta con saltos |

### 3.3 Webhooks y Trazabilidad

| # | Riesgo | Severidad | Impacto |
|---|--------|-----------|---------|
| 8 | Webhook progreso sin formData real | 🟠 ALTO | Zoho no ve datos actuales |
| 9 | Webhook progreso sin Excel | 🟡 MEDIO | No hay respaldo descargable |
| 10 | sendProgressWebhook fire-and-forget | 🟢 BAJO | Errores silenciosos |

### 3.4 Encriptación y Tokens

| # | Riesgo | Severidad | Impacto |
|---|--------|-----------|---------|
| 11 | Token contiene TODOS los datos | 🟡 MEDIO | URL muy larga, difícil de manejar |
| 12 | Token no se puede invalidar | 🟡 MEDIO | Link permanente sin expiración |
| 13 | Token desactualizado si CRM cambia datos | 🟠 ALTO | Datos obsoletos |

---

## 4. FLUJO PROPUESTO CON PERSISTENCIA

### 4.1 Cambios Fundamentales

**ANTES (Actual):**
\`\`\`
Token → Todos los datos encriptados
Usuario → Lee datos del token una vez
Datos → Solo en memoria (useState)
Cierra navegador → PIERDE TODO
\`\`\`

**DESPUÉS (Con persistencia):**
\`\`\`
Token → Solo UUID del registro
Usuario → Lee datos de BD
Datos → En BD (Supabase)
Auto-save → Cada 5 segundos
Cierra navegador → Datos persisten
\`\`\`

### 4.2 Nueva Arquitectura

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                     CRM (ZOHO)                               │
└─────────────────────┬───────────────────────────────────────┘
                      │ POST /api/generate-link
                      │ { empresa: {...} }
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          /api/generate-link (NUEVO)                          │
│  1. INSERT INTO onboardings (datos_iniciales, id_zoho)      │
│  2. Generar UUID                                             │
│  3. Token = UUID (simple, sin encriptación de datos)        │
│  4. Devolver link con UUID                                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          Usuario abre link (?token=UUID)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ GET /api/onboarding/[uuid]
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          /api/onboarding/[uuid] (NUEVO)                      │
│  1. SELECT * FROM onboardings WHERE id = uuid                │
│  2. Devolver datos_actuales + navigationHistory             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│    components/onboarding-turnos.tsx (MODIFICADO)            │
│  1. Cargar datos desde BD                                    │
│  2. useState: navigationHistory                              │
│  3. useEffect: Auto-save cada 5s                            │
│  4. handleNext: guardar + agregar a historial               │
│  5. handlePrev: guardar + remover del historial             │
└─────────────────────┬───────────────────────────────────────┘
                      │ PATCH /api/onboarding/[uuid]
                      │ cada 5s o al cambiar paso
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          /api/onboarding/[uuid] (NUEVO)                      │
│  1. UPDATE onboardings SET                                   │
│     datos_actuales = { formData, navigationHistory }        │
│  2. Merge inteligente (NO sobrescribir datos conocidos)     │
└─────────────────────────────────────────────────────────────┘
\`\`\`

### 4.3 Solución a Cada Riesgo

| Riesgo Original | Solución con Persistencia |
|----------------|---------------------------|
| #1 Cierra navegador | Datos en BD, puede continuar después |
| #2 Recarga página | Carga desde BD, mismo estado |
| #3 No auto-save | Auto-save cada 5s a BD |
| #4 formData desactualizado | `formDataRef.current` siempre actualizado |
| #5 Race condition | Merge inteligente en backend |
| #6 Sin historial | `navigationHistory` en estado y BD |
| #7 prevStep - 1 | `navigationHistory.pop()` para paso real |
| #8 Webhook sin formData | Enviar `formData` completo desde estado |
| #9 Webhook sin Excel | Generar Excel en todos los webhooks |
| #10 Fire-and-forget | Mantener (es correcto para no bloquear UX) |
| #11 Token grande | Token = UUID pequeño |
| #12 No se puede invalidar | Registro en BD, se puede marcar inválido |
| #13 Token desactualizado | BD es fuente de verdad, siempre actual |

---

## 5. REGLA DE ORO PARA PERSISTENCIA

**NUNCA actualizar un dato existente por un dato desconocido, solo por un dato diferente pero siempre conocido.**

### 5.1 Qué significa "dato conocido"

**CONOCIDO:**
- Usuario escribió en el campo
- Valor vino del prellenado del CRM
- Valor fue modificado conscientemente

**DESCONOCIDO:**
- Array vacío `[]` por defecto de useState
- String vacío `""` de inicialización
- `null` o `undefined` no intencional

### 5.2 Ejemplos Prácticos

**❌ MAL - Sobrescribir datos con vacíos:**
\`\`\`typescript
// BD tiene: admins = [admin1]
// Frontend envía: admins = [] (por useState desactualizado)

// Backend hace:
UPDATE onboardings SET datos_actuales = {
  formData: { admins: [] }  // ← BORRA admin1 ❌
}
\`\`\`

**✅ BIEN - Merge inteligente:**
\`\`\`typescript
// BD tiene: admins = [admin1]
// Frontend envía: admins = [] (dato desconocido)

// Backend hace:
const existingData = await supabase.select(...)
const newData = request.body.formData

// Merge:
const merged = {
  admins: newData.admins.length > 0 
    ? newData.admins           // Dato conocido, usar nuevo
    : existingData.admins      // Dato desconocido, mantener existente
}

UPDATE onboardings SET datos_actuales = merged
\`\`\`

**✅ BIEN - Frontend envía siempre estado completo:**
\`\`\`typescript
// Usar formDataRef para tener siempre el estado actual
const formDataRef = useRef(formData)
useEffect(() => {
  formDataRef.current = formData
}, [formData])

// Al guardar:
await fetch('/api/onboarding/uuid', {
  body: JSON.stringify({
    formData: formDataRef.current  // ← Siempre actualizado
  })
})
\`\`\`

---

## 6. CONCLUSIONES

### 6.1 Estado Actual
- ✅ Sistema funcional para flujo completo sin interrupciones
- ❌ Pérdida total de datos si usuario cierra navegador
- ❌ Sin trazabilidad de progreso real en webhooks
- ❌ Navegación incorrecta con saltos de pasos

### 6.2 Necesidad de Persistencia
- 🔴 CRÍTICO: Implementar base de datos para no perder progreso
- 🟠 ALTO: Auto-save cada 5 segundos
- 🟡 MEDIO: Historial de navegación para botón "Atrás"
- 🟡 MEDIO: Webhooks con formData completo

### 6.3 Próximos Pasos
1. Implementar base de datos Supabase
2. Crear APIs de persistencia (GET/PATCH /api/onboarding/[id])
3. Agregar auto-save al frontend
4. Implementar navigationHistory
5. Actualizar webhooks con formData real
6. Testing exhaustivo de merge de datos

---

**FIN DEL ANÁLISIS**
