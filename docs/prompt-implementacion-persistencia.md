# PROMPT PARA IMPLEMENTACIÓN DE PERSISTENCIA CON BASE DE DATOS (SIMPLIFICADO)

## ⚠️ REGLA DE ORO - PRINCIPIO FUNDAMENTAL

**NUNCA actualizar un dato existente por un dato desconocido, SOLO por un dato diferente pero siempre conocido.**

### Qué significa:

✅ **PERMITIDO:**
\`\`\`json
BD tiene:     { "empresa": { "razonSocial": "Empresa X", "rut": "12345678-9" } }
Frontend envía: { "empresa": { "razonSocial": "Empresa Y", "rut": "12345678-9" } }
Resultado:    { "empresa": { "razonSocial": "Empresa Y", "rut": "12345678-9" } }
// ✓ razonSocial cambió de X a Y (dato conocido diferente)
\`\`\`

❌ **NO PERMITIDO:**
\`\`\`json
BD tiene:     { "admins": [{ "nombre": "Juan", "rut": "12345678-9" }] }
Frontend envía: { "admins": [] }
Resultado:    { "admins": [{ "nombre": "Juan", "rut": "12345678-9" }] }
// ✓ NO sobrescribe porque el array vacío es "desconocido/sin datos"
\`\`\`

❌ **NO PERMITIDO:**
\`\`\`json
BD tiene:     { "empresa": { "razonSocial": "Empresa X", "rut": "12345678-9", "giro": "Servicios" } }
Frontend envía: { "empresa": { "razonSocial": "Empresa Y" } }  // Falta rut y giro
Resultado:    { "empresa": { "razonSocial": "Empresa Y", "rut": "12345678-9", "giro": "Servicios" } }
// ✓ Merge inteligente: actualiza razonSocial, mantiene rut y giro
\`\`\`

### Implementación:

**Backend debe implementar lógica de MERGE INTELIGENTE:**

\`\`\`typescript
function mergeFormData(existingData: OnboardingFormData, newData: Partial<OnboardingFormData>): OnboardingFormData {
  const merged = { ...existingData }
  
  // 1. Empresa: merge profundo, no sobrescribir con valores vacíos
  if (newData.empresa) {
    merged.empresa = {
      ...existingData.empresa,
      ...Object.fromEntries(
        Object.entries(newData.empresa).filter(([_, value]) => 
          value !== '' && value !== null && value !== undefined &&
          !(Array.isArray(value) && value.length === 0)
        )
      )
    }
  }
  
  // 2. Arrays: solo sobrescribir si el nuevo array tiene datos
  const arrayFields = ['admins', 'trabajadores', 'turnos', 'planificaciones', 'asignaciones']
  arrayFields.forEach(field => {
    if (newData[field] !== undefined) {
      // Solo actualizar si el nuevo array tiene elementos
      if (newData[field].length > 0) {
        merged[field] = newData[field]
      }
      // Si el nuevo array está vacío, mantener el existente
    }
  })
  
  // 3. Booleanos: siempre actualizar (tienen valores conocidos)
  if (newData.configureNow !== undefined) merged.configureNow = newData.configureNow
  if (newData.loadWorkersNow !== undefined) merged.loadWorkersNow = newData.loadWorkersNow
  
  return merged
}
\`\`\`

**Frontend debe siempre enviar el estado COMPLETO actual:**

\`\`\`typescript
// ❌ MAL: enviar solo cambios parciales
await fetch('/api/onboarding/id', {
  body: JSON.stringify({
    formData: { empresa: { razonSocial: "Empresa Y" } }  // Falta el resto
  })
})

// ✅ BIEN: enviar siempre formData completo
await fetch('/api/onboarding/id', {
  body: JSON.stringify({
    formData: formData  // Estado completo actual del frontend
  })
})
\`\`\`

---

## ENFOQUE SIMPLIFICADO

**IMPORTANTE:** Este sistema reemplaza completamente el sistema de tokenización anterior. No hay compatibilidad hacia atrás.

### Principios clave:
1. ✅ Token = UUID simple (ID del registro en BD)
2. ✅ Una fila por onboarding (siempre UPDATE, nunca INSERT múltiple)
3. ✅ Estructura de datos siempre igual (aunque incompleta)
4. ✅ Todo se guarda en `datos_actuales` en BD
5. ✅ No hay encriptación de datos completos
6. ✅ No hay compatibilidad con sistema antiguo
7. ✅ **Frontend valida ANTES de guardar (no necesita merge en backend)**

## CONTEXTO

**Sistema ANTERIOR (eliminar completamente):**
- ❌ Token contenía datos encriptados completos
- ❌ API `/api/decrypt-token` desencriptaba datos del token
- ❌ Datos vivían solo en el token

**Sistema NUEVO (implementar):**
- ✅ Token contiene solo UUID (ID del registro)
- ✅ BD es la única fuente de verdad
- ✅ Frontend y backend siempre consultan BD
- ✅ Auto-save cada 5 segundos
- ✅ Historial de navegación persiste en BD

---

# PROMPT PARA IMPLEMENTACIÓN DE PERSISTENCIA CON BASE DE DATOS

## CONTEXTO

Actualmente el sistema funciona con tokenización:
- CRM envía datos a /api/generate-link
- Se genera un token encriptado con datos prellenados
- Usuario abre link y ve formulario prellenado
- Si cierra el navegador, pierde el progreso
- La navegación "Atrás" resta 1 al paso actual (no sigue el flujo real del usuario)

---

## ESTRUCTURA ACTUAL DE PASOS (VERIFICADA)

**Total de pasos: 12 (índices 0-11)**

0. Bienvenida (BienvenidaMarketingStep)
1. Antes de comenzar (AntesDeComenzarStep)
2. Datos de empresa (EmpresaStep) - **OBLIGATORIO**
3. Administradores (AdminStep) - **OBLIGATORIO (mínimo 1)**
4. Decisión trabajadores (WorkersDecisionStep)
5. Trabajadores (TrabajadoresStep) - opcional
6. Decisión turnos (DecisionStep)
7. Turnos (TurnosStep) - opcional
8. Planificaciones (PlanificacionesStep) - opcional
9. Asignaciones (AsignacionesStep) - opcional
10. Resumen (ResumenStep)
11. Página de agradecimiento (AgradecimientoStep)

---

## FLUJOS DE NAVEGACIÓN CON SALTOS

**Saltos implementados:**
- Si usuario elige "Cargar trabajadores en capacitación" (paso 4) → salta de 4 a 6 (omite paso 5)
- Si usuario elige "Configurar turnos en capacitación" (paso 6) → salta de 6 a 10 (omite pasos 7,8,9)

**Problema actual:**
- Botón "Atrás" resta 1 al paso actual
- No sigue el historial real del usuario

**Solución requerida:**
- Implementar historial de navegación que persista en BD
- Botón "Atrás" debe seguir el flujo real

**Ejemplo de historial:**
\`\`\`
Usuario hace: 0 → 1 → 2 → 3 → 4 → 6 (saltó 5) → 10 (saltó 7,8,9)
navigationHistory: [0, 1, 2, 3, 4, 6, 10]

"Atrás" desde paso 10 → debe ir a paso 6 (NO a paso 9)
"Atrás" desde paso 6 → debe ir a paso 4 (NO a paso 5)
\`\`\`

---

## ESTRUCTURA EXACTA DEL FORMDATA (NO MODIFICAR)

\`\`\`typescript
type OnboardingFormData = {
  empresa: {
    razonSocial: string
    nombreFantasia: string
    rut: string
    giro: string
    direccion: string
    comuna: string
    emailFacturacion: string
    telefonoContacto: string
    sistema: string[] // Array de sistemas
    rubro: string
    grupos: { id: number; nombre: string; descripcion: string }[]
    id_zoho: string | null // IMPORTANTE: siempre string o null
  }
  admins: {
    id: number
    nombre: string
    apellido: string
    rut: string
    email: string
    telefono: string
    grupoId: string
    grupoNombre: string
  }[]
  trabajadores: {
    id: number
    nombre: string
    rut: string
    correo: string
    grupoId: string
    telefono1: string
    telefono2: string
    telefono3: string
    tipo: "usuario" | "administrador"
  }[]
  turnos: {
    id: number
    nombre: string
    horaInicio: string
    horaFin: string
    tipoColacion: "sin" | "libre" | "fija"
    colacionMinutos: number
    colacionInicio: string
    colacionFin: string
    tooltip: string
  }[]
  planificaciones: {
    id: number
    nombre: string
    diasTurnos: (number | null)[] // Array de 7 elementos (lun-dom)
  }[]
  asignaciones: {
    id: number
    trabajadorId: string | number
    planificacionId: string | number
    desde: string
    hasta: string
  }[]
  configureNow: boolean // true = configurar turnos ahora, false = después
  loadWorkersNow: boolean // true = cargar trabajadores ahora, false = en capacitación
}
\`\`\`

---

## CAMPOS OBLIGATORIOS (CON VALIDACIÓN IMPLEMENTADA)

### Empresa (Paso 2):
- razonSocial
- nombreFantasia
- rut (formato chileno)
- giro
- direccion
- comuna
- emailFacturacion (formato email válido)
- telefonoContacto (mínimo 8 dígitos)
- sistema (al menos 1)
- rubro

### Administradores (Paso 3):
- nombre
- apellido
- rut (formato chileno)
- email (formato válido)
- telefono (mínimo 8 dígitos)
- **MÍNIMO 1 administrador requerido**

**IMPORTANTE - VALIDACIONES COMO BARRERA DE PROTECCIÓN:**
- Las validaciones del frontend DEBEN asegurar que los datos existan antes de permitir avanzar
- No se permite avanzar de paso sin completar los campos obligatorios
- Esto garantiza que NUNCA se guarden datos vacíos en la BD cuando deberían estar completos
- Las validaciones visuales ayudan al usuario a completar correctamente antes de avanzar

---

## VALIDACIONES VISUALES IMPLEMENTADAS

- Mensajes de error debajo de cada campo
- Validación de formato: email, RUT chileno, teléfono
- Toast messages generales
- Botones siempre habilitados, validación al hacer clic
- NO se usan botones disabled

---

## FUNCIONES CRÍTICAS A PRESERVAR

1. `fetchTokenData(token)` - Desencripta y obtiene datos
2. `loadDataFromPrefill(data)` - Carga datos prellenados al formData
3. `handleNext()` - Validación + navegación + webhook progreso
4. `handlePrev()` - Navegación atrás + webhook progreso  
5. `handleWorkersDecision(decision)` - Salta a paso 5 o 6
6. `handleConfigurationDecision(decision)` - Salta a paso 7 o 10
7. `handleFinalizar()` - Envía todo + navega a paso 11
8. `validateEmpresaFields(empresa)` - Validación empresa
9. `validateAdminsFields(admins)` - Validación admins
10. `sendProgressWebhook(params)` - Webhook fire-and-forget

---

## REQUERIMIENTOS DE IMPLEMENTACIÓN

### 1. BASE DE DATOS (Supabase)

\`\`\`sql
CREATE TABLE onboardings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_zoho TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'en_progreso', 'completado')),
  datos_actuales JSONB NOT NULL, -- Solo datos_actuales, no datos_iniciales
  ultimo_paso INTEGER DEFAULT 0,
  navigation_history INTEGER[] DEFAULT ARRAY[0],
  fecha_ultima_actualizacion TIMESTAMP DEFAULT NOW(),
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_completado TIMESTAMP,
  
  INDEX idx_id_zoho (id_zoho),
  INDEX idx_estado (estado),
  INDEX idx_fecha_actualizacion (fecha_ultima_actualizacion)
);
\`\`\`

**Cambios vs sistema anterior:**
- ❌ ELIMINADO: `datos_iniciales` (no es necesario)
- ✅ Solo `datos_actuales` contiene toda la información
- ✅ Misma estructura siempre (aunque campos estén vacíos o llenos)

### 2. ESTRUCTURA DE datos_actuales EN BD

\`\`\`typescript
{
  empresa: {
    razonSocial: string | "",
    nombreFantasia: string | "",
    rut: string | "",
    // ... todos los campos (vacíos o llenos)
  },
  admins: [], // Array vacío o con datos
  trabajadores: [], // Array vacío o con datos
  turnos: [],
  planificaciones: [],
  asignaciones: [],
  configureNow: boolean,
  loadWorkersNow: boolean
}
\`\`\`

**Punto clave:** La estructura es SIEMPRE la misma, aunque los arrays estén vacíos o los strings en blanco.

### 3. TOKEN SIMPLE COMO UUID

**ANTES:**
\`\`\`typescript
// Token contenía esto:
const token = encryptToken({
  empresa: {...}, // Todos los datos
  admins: [...],
  // etc
})
\`\`\`

**AHORA:**
\`\`\`typescript
// Token solo contiene el ID:
const token = onboarding.id // UUID simple: "550e8400-e29b-41d4-a716-446655440000"
\`\`\`

**Encriptación opcional:**
- Si quieres ofuscar el UUID, puedes usar una función simple
- Pero no es necesario encriptar datos (ya están en BD)

---

### 4. APIS A CREAR/MODIFICAR

#### ELIMINAR: /api/decrypt-token (ya no es necesaria)

❌ Esta API ya no existe. El token ES el ID.

#### NUEVA: GET /api/onboarding/[id]/route.ts

\`\`\`typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    const { data: onboarding, error } = await supabase
      .from('onboardings')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error || !onboarding) {
      return NextResponse.json(
        { success: false, error: 'Onboarding no encontrado' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: onboarding.datos_actuales, // OnboardingFormData completo
      lastStep: onboarding.ultimo_paso,
      navigationHistory: onboarding.navigation_history,
      estado: onboarding.estado
    })
  } catch (error) {
    console.error('[API] Error al obtener onboarding:', error)
    return NextResponse.json(
      { success: false, error: 'Error del servidor' },
      { status: 500 }
    )
  }
}
\`\`\`

#### NUEVA: PATCH /api/onboarding/[id]/route.ts

\`\`\`typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const incomingData = await request.json()
    
    console.log('[v0] Actualizando onboarding:', id)
    
    // 1. Obtener registro existente para verificar que existe
    const { data: existing, error: fetchError } = await supabase
      .from('onboardings')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Onboarding no encontrado' }, 
        { status: 404 }
      )
    }
    
    // 2. UPDATE directo con los datos del frontend
    // No necesitamos merge porque frontend valida antes de enviar
    const { error: updateError } = await supabase
      .from('onboardings')
      .update({
        datos_actuales: incomingData.formData,
        ultimo_paso: incomingData.currentStep,
        navigation_history: incomingData.navigationHistory,
        estado: incomingData.estado || 'en_progreso',
        fecha_ultima_actualizacion: new Date().toISOString(),
        ...(incomingData.fecha_completado && {
          fecha_completado: incomingData.fecha_completado
        })
      })
      .eq('id', id)
    
    if (updateError) {
      console.error('[v0] Error al actualizar:', updateError)
      return NextResponse.json(
        { success: false, error: updateError.message }, 
        { status: 500 }
      )
    }
    
    console.log('[v0] Actualización exitosa')
    
    return NextResponse.json({ 
      success: true, 
      data: incomingData.formData 
    })
    
  } catch (error) {
    console.error('[v0] Error en PATCH:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}
\`\`\`

#### MODIFICAR: POST /api/generate-link/route.ts

\`\`\`typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // body viene del CRM con: { id_zoho, razonSocial, nombreFantasia, rut, ... }
    
    const datosIniciales = {
      empresa: {
        razonSocial: body.razonSocial || "",
        nombreFantasia: body.nombreFantasia || "",
        rut: body.rut || "",
        giro: body.giro || "",
        direccion: body.direccion || "",
        comuna: body.comuna || "",
        emailFacturacion: body.emailFacturacion || "",
        telefonoContacto: body.telefonoContacto || "",
        sistema: body.sistema || [],
        rubro: body.rubro || "",
        grupos: [],
        id_zoho: String(body.id_zoho)
      },
      admins: [],
      trabajadores: [],
      turnos: [],
      planificaciones: [],
      asignaciones: [],
      configureNow: false,
      loadWorkersNow: false
    }
    
    const { data: onboarding, error } = await supabase
      .from('onboardings')
      .insert({
        id_zoho: String(body.id_zoho),
        estado: 'pendiente',
        datos_actuales: datosIniciales, // Estructura completa
        ultimo_paso: 0,
        navigation_history: [0]
      })
      .select()
      .single()
    
    if (error || !onboarding) {
      console.error('[API] Error al crear onboarding:', error)
      return NextResponse.json(
        { success: false, error: 'Error al crear registro' },
        { status: 500 }
      )
    }
    
    const token = onboarding.id // "550e8400-e29b-41d4-a716-446655440000"
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const link = `${baseUrl}?token=${token}`
    
    return NextResponse.json({
      success: true,
      link,
      token,
      id: onboarding.id
    })
  } catch (error) {
    console.error('[API] Error al generar link:', error)
    return NextResponse.json(
      { success: false, error: 'Error del servidor' },
      { status: 500 }
    )
  }
}
\`\`\`

---

### 5. FRONTEND - MODIFICACIONES EN components/onboarding-turnos.tsx

#### A) useState para onboardingId y navigationHistory

\`\`\`typescript
const [onboardingId, setOnboardingId] = useState<string | null>(null)
const [navigationHistory, setNavigationHistory] = useState<number[]>([0])
\`\`\`

#### B) Modificar useEffect de inicialización

\`\`\`typescript
useEffect(() => {
  const initializeData = async () => {
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get("token")
    
    if (token) {
      try {
        // 1. Token es el UUID directo (sin encriptación compleja)
        setOnboardingId(token)
        
        // 2. Cargar datos desde BD
        const response = await fetch(`/api/onboarding/${token}`)
        const result = await response.json()
        
        if (result.success) {
          // 3. Cargar datos al formulario
          loadDataFromPrefill(result.data)
          setCurrentStep(result.lastStep)
          setNavigationHistory(result.navigationHistory)
          setIdZoho(result.data.empresa.id_zoho)
          setHasToken(true)
        }
      } catch (error) {
        console.error('[v0] Error al cargar datos:', error)
        toast.error("Error al cargar los datos del onboarding")
      }
    }
    
    setIsInitialized(true)
  }
  
  initializeData()
}, [])
\`\`\`

#### C) Modificar handleNext - Guardar DESPUÉS de validación

\`\`\`typescript
const handleNext = useCallback(async () => {
  // PASO 1: Validaciones existentes (OBLIGATORIAS)
  if (currentStep === 2) {
    const validation = validateEmpresaFields(formData.empresa)
    if (!validation.isValid) {
      toast.error("Por favor completa todos los campos obligatorios")
      return // ← NO avanza si hay errores
    }
  }
  
  if (currentStep === 3) {
    const validation = validateAdminsFields(formData.admins)
    if (!validation.isValid) {
      toast.error("Por favor agrega al menos un administrador válido")
      return // ← NO avanza si hay errores
    }
  }
  
  // PASO 2: Calcular siguiente paso
  const nextStep = currentStep + 1
  
  // PASO 3: Guardar en BD (SOLO SI VALIDÓ)
  if (onboardingId) {
    try {
      await fetch(`/api/onboarding/${onboardingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: formData, // ← Estado completo validado
          currentStep: nextStep,
          navigationHistory: [...navigationHistory, nextStep]
        })
      })
      console.log('[v0] Datos guardados al avanzar a paso', nextStep)
    } catch (error) {
      console.error('[v0] Error al guardar:', error)
      toast.error("Error al guardar los datos. Intenta nuevamente.")
      return // ← NO avanza si falla el guardado
    }
  }
  
  // PASO 4: Enviar webhook de progreso
  sendProgressWebhook({
    paso: nextStep,
    formData: formData
  }).catch(console.error)
  
  // PASO 5: Actualizar estado local
  setCurrentStep(nextStep)
  setNavigationHistory(prev => [...prev, nextStep])
  setCompletedSteps(prev => [...new Set([...prev, currentStep])])
  
}, [onboardingId, formData, navigationHistory, currentStep, ...])
\`\`\`

#### D) Modificar handlePrev - Solo navegar (NO guardar)

\`\`\`typescript
const handlePrev = useCallback(async () => {
  if (navigationHistory.length <= 1) return // No hay dónde volver
  
  // PASO 1: Calcular paso anterior usando historial
  const newHistory = navigationHistory.slice(0, -1)
  const previousStep = newHistory[newHistory.length - 1]
  
  // PASO 2: Actualizar estado local (NO se guarda en BD)
  setNavigationHistory(newHistory)
  setCurrentStep(previousStep)
  
  console.log('[v0] Navegando atrás a paso', previousStep, '(sin guardar)')
  
}, [navigationHistory])
\`\`\`

**JUSTIFICACIÓN:**
- Los datos ya se guardaron cuando el usuario presionó "Siguiente" en ese paso
- Si el usuario modifica algo después de retroceder, se guardará cuando vuelva a presionar "Siguiente"
- No hay necesidad de guardar datos no validados

#### E) Modificar handleWorkersDecision - Guardar inmediatamente

\`\`\`typescript
const handleWorkersDecision = useCallback(async (loadNow: boolean) => {
  const updatedFormData = { ...formData, loadWorkersNow: loadNow }
  setFormData(updatedFormData)
  
  const nextStep = loadNow ? 5 : 6
  
  // Guardar en BD inmediatamente
  if (onboardingId) {
    try {
      await fetch(`/api/onboarding/${onboardingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: updatedFormData, // ← Usar dato actualizado
          currentStep: nextStep,
          navigationHistory: [...navigationHistory, nextStep]
        })
      })
      console.log('[v0] Decisión trabajadores guardada:', loadNow)
    } catch (error) {
      console.error('[v0] Error al guardar decisión:', error)
      toast.error("Error al guardar. Intenta nuevamente.")
      return
    }
  }
  
  setCurrentStep(nextStep)
  setNavigationHistory(prev => [...prev, nextStep])
  
}, [onboardingId, formData, navigationHistory])
\`\`\`

#### F) Modificar handleConfigurationDecision - Guardar inmediatamente

\`\`\`typescript
const handleConfigurationDecision = useCallback(async (configureNow: boolean) => {
  const updatedFormData = { ...formData, configureNow }
  setFormData(updatedFormData)
  
  const nextStep = configureNow ? 7 : 10
  
  // Guardar en BD inmediatamente
  if (onboardingId) {
    try {
      await fetch(`/api/onboarding/${onboardingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: updatedFormData, // ← Usar dato actualizado
          currentStep: nextStep,
          navigationHistory: [...navigationHistory, nextStep]
        })
      })
      console.log('[v0] Decisión turnos guardada:', configureNow)
    } catch (error) {
      console.error('[v0] Error al guardar decisión:', error)
      toast.error("Error al guardar. Intenta nuevamente.")
      return
    }
  }
  
  setCurrentStep(nextStep)
  setNavigationHistory(prev => [...prev, nextStep])
  
}, [onboardingId, formData, navigationHistory])
\`\`\`

#### G) Modificar handleFinalizar

\`\`\`typescript
const handleFinalizar = useCallback(async () => {
  // PASO 1: Marcar como completado en BD
  if (onboardingId) {
    try {
      await fetch(`/api/onboarding/${onboardingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: formData,
          currentStep: 11,
          navigationHistory: [...navigationHistory, 11],
          estado: 'completado',
          fecha_completado: new Date().toISOString()
        })
      })
      console.log('[v0] Onboarding marcado como completado')
    } catch (error) {
      console.error('[v0] Error al finalizar:', error)
      toast.error("Error al finalizar. Intenta nuevamente.")
      return
    }
  }
  
  // PASO 2: Generar payload completo
  const payload: ZohoPayload = {
    accion: "completado",
    eventType: "complete",
    id_zoho: idZoho,
    fechaHoraEnvio: new Date().toISOString(),
    formData: formData,
    metadata: {
      empresaRut: formData.empresa.rut,
      empresaNombre: formData.empresa.nombreFantasia || formData.empresa.razonSocial,
      pasoActual: 11,
      pasoNombre: "Completado",
      totalPasos: 12,
      porcentajeProgreso: 100
    },
    excelFile: null // Se genera en la API
  }
  
  // PASO 3: Enviar a Zoho (no esperar respuesta)
  fetch('/api/submit-to-zoho', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(console.error)
  
  // PASO 4: Navegar a página de gracias
  setCurrentStep(11)
  setNavigationHistory(prev => [...prev, 11])
  
}, [onboardingId, formData, navigationHistory, idZoho])
\`\`\`

---

### 8. MOMENTOS EXACTOS DE GUARDADO EN BD

| Acción del Usuario | Cuándo se Guarda | Qué se Guarda |
|-------------------|------------------|---------------|
| Escribe en campos | ❌ NO se guarda | Solo en memoria local (React state) |
| Click "Siguiente" | ✅ Después de validar | formData completo + nuevo paso en historial |
| Click "Atrás" | ❌ NO se guarda | Solo navegación local |
| Decisión trabajadores | ✅ Inmediatamente | formData + loadWorkersNow + salto de paso |
| Decisión turnos | ✅ Inmediatamente | formData + configureNow + salto de paso |
| "Confirmar y Enviar" | ✅ Inmediatamente | formData completo + estado='completado' |
| Cierra navegador | ❌ NO se guarda | Se pierde lo no guardado del paso actual |
| Recarga página | Se carga último guardado | Último estado guardado en BD |

**VENTAJAS DE ESTE ENFOQUE:**
- ✅ No hay race conditions (no hay guardados simultáneos)
- ✅ Datos siempre validados antes de guardar
- ✅ Simplicidad en el código (menos useEffect)
- ✅ Menos llamadas a la BD
- ✅ Estado local predecible
- ✅ Guardado explícito = usuario sabe cuándo se guarda

**COMPORTAMIENTO ACEPTADO:**
- Si usuario cierra navegador sin hacer clic en "Siguiente", pierde cambios del paso actual
- Es comportamiento estándar de formularios (similar a Google Forms, Typeform, etc.)
- El usuario tiene control: solo avanza cuando confirma con "Siguiente"

---

### 11. PROTECCIÓN CONTRA PÉRDIDA DE DATOS

#### CHECKLIST DE SEGURIDAD:

**Guardado de datos:**
- [ ] ❌ NO hay auto-save con setInterval
- [ ] ✅ Guardado solo en handleNext (después de validaciones exitosas)
- [ ] ❌ NO hay guardado en handlePrev (solo navegación)
- [ ] ✅ Guardado en handleWorkersDecision (decisión explícita)
- [ ] ✅ Guardado en handleConfigurationDecision (decisión explícita)
- [ ] ✅ Guardado en handleFinalizar (acción final)

**Validaciones que protegen datos:**
- [ ] ✅ validateEmpresaFields impide avanzar sin datos completos
- [ ] ✅ validateAdminsFields impide avanzar sin al menos 1 admin
- [ ] ✅ handleNext solo guarda si validaciones pasan
- [ ] ✅ Toast messages informan al usuario qué falta

**Backend merge inteligente:**
- [ ] ✅ API PATCH usa función `mergeFormData` con regla de oro
- [ ] ✅ Solo actualiza campos que vienen con valores conocidos
- [ ] ✅ Nunca sobrescribe arrays con datos por arrays vacíos
- [ ] ✅ Preserva datos existentes si no vienen en la petición

---

## RESULTADO ESPERADO

- Usuario puede cerrar navegador después de hacer clic en "Siguiente" y continuar desde ese paso
- Si cierra sin hacer clic en "Siguiente", pierde cambios del paso actual (comportamiento estándar aceptado)
- Datos persisten solo cuando están validados (frontend garantiza integridad)
- Historial de navegación persiste entre sesiones
- Botón "Atrás" solo navega, no guarda
- Si usuario salta pasos, "Atrás" respeta los saltos
- Sin auto-save = sin race conditions = datos siempre consistentes
- Backend simple con UPDATE directo (no necesita merge)
- Zoho recibe webhooks con estructura idéntica (progreso y completado)
- Excel se genera en cada webhook mostrando estado actual
- Sistema completo de trazabilidad en BD
- Experiencia de usuario predecible y sin cambios visibles
- Todas las validaciones siguen funcionando igual
- Guardado explícito y predecible para el usuario
