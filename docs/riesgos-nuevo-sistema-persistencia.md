# ANÁLISIS DE RIESGOS DEL NUEVO SISTEMA DE PERSISTENCIA

> Análisis de riesgos potenciales DESPUÉS de implementar el sistema de persistencia con Supabase

---

## 🔴 RIESGOS CRÍTICOS

### 1. **Race Condition entre Auto-Save y Navegación**

**Descripción:**
Auto-save se ejecuta cada 5 segundos, pero también guardamos en cada cambio de paso. Podrían ejecutarse simultáneamente.

**Escenario:**
\`\`\`
t=0s:   Usuario llena admin y hace clic en "Siguiente"
t=0.1s: handleNext llama PATCH /api/onboarding/[id] → { admins: [admin1] }
t=0.2s: Auto-save se ejecuta → llama PATCH /api/onboarding/[id] → { admins: [admin1] }
t=0.3s: Respuesta 1 llega (handleNext)
t=0.4s: Respuesta 2 llega (auto-save) con datos viejos → podría sobrescribir
\`\`\`

**Consecuencia:**
- Dos requests simultáneos al mismo endpoint
- El último en llegar sobrescribe al anterior
- Posible pérdida de datos si auto-save tiene estado desactualizado

**Mitigación en el prompt:**
\`\`\`typescript
// Frontend: Cancelar auto-save al hacer cambio manual
const handleNext = useCallback(async () => {
  // Detener auto-save temporalmente
  clearInterval(autoSaveIntervalRef.current)
  
  // Guardar manualmente
  await saveToDatabase()
  
  // Reiniciar auto-save después
  startAutoSave()
}, [...])
\`\`\`

**Riesgo residual:** MEDIO - El prompt tiene merge inteligente en backend que debería proteger

---

### 2. **Merge Inteligente con Arrays Modificados**

**Descripción:**
La lógica de merge en backend solo sobrescribe arrays si tienen datos. Pero ¿qué pasa si el usuario ELIMINA un item?

**Escenario:**
\`\`\`json
BD tiene:     { "admins": [admin1, admin2] }
Usuario elimina admin2 en frontend
Frontend envía: { "admins": [admin1] }
Backend merge: Ve que array tiene datos (length > 0) → actualiza
Resultado:    { "admins": [admin1] } ✅
\`\`\`

✅ **Funciona bien si el array tiene datos**

Pero:
\`\`\`json
BD tiene:     { "admins": [admin1] }
Usuario elimina admin1 (único admin)
Frontend envía: { "admins": [] }
Backend merge: Ve array vacío → NO actualiza por REGLA DE ORO
Resultado:    { "admins": [admin1] } ❌ NO se eliminó
\`\`\`

**Consecuencia:**
- Usuario no puede eliminar el ÚLTIMO item de un array
- Violación de la REGLA DE ORO en casos de eliminación legítima

**Solución requerida:**
Necesitamos diferenciar entre:
- `admins: []` desconocido (no tocar BD)
- `admins: []` conocido y deliberado (usuario eliminó todo)

**Propuesta:**
\`\`\`typescript
// Agregar metadatos de intención
{
  formData: {
    admins: [],
    _meta: {
      admins_intentional_empty: true  // Usuario eliminó todo deliberadamente
    }
  }
}

// Backend verifica metadata
if (incomingData._meta?.admins_intentional_empty) {
  merged.admins = []  // Permitir array vacío
}
\`\`\`

**Riesgo:** ALTO - No está implementado en el prompt actual

---

### 3. **Estado Desactualizado en Closures de useCallback**

**Descripción:**
Los useCallback capturan valores en sus dependencias, pero si formData cambia muy rápido, el callback puede tener datos viejos.

**Escenario:**
\`\`\`typescript
const handleNext = useCallback(async () => {
  // Este formData viene de las dependencias al momento de crear el callback
  await fetch('/api/onboarding/id', {
    body: JSON.stringify({ formData })  // ← Puede estar desactualizado
  })
}, [formData, currentStep])

// Usuario hace:
setFormData({ ...formData, admins: [admin1] })  // t=0ms
// React no actualiza el callback inmediatamente
handleNext()  // t=50ms ← Usa formData viejo sin admin1
\`\`\`

**Consecuencia:**
- Callback usa estado desactualizado
- Se envían datos viejos a la BD

**Mitigación requerida:**
\`\`\`typescript
// Usar refs para datos siempre actualizados
const formDataRef = useRef(formData)
useEffect(() => {
  formDataRef.current = formData
}, [formData])

const handleNext = useCallback(async () => {
  await fetch('/api/onboarding/id', {
    body: JSON.stringify({ formData: formDataRef.current })  // ✅ Siempre actual
  })
}, [/* no incluir formData */])
\`\`\`

**Riesgo:** ALTO - El prompt usa dependencias directas sin refs

---

## 🟠 RIESGOS ALTOS

### 4. **Conexión a Supabase en Múltiples Lugares**

**Descripción:**
Cada API route crea su propio cliente de Supabase. Si las credenciales son incorrectas o hay límite de conexiones, puede fallar.

**Código en prompt:**
\`\`\`typescript
// En cada route.ts:
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
\`\`\`

**Riesgos:**
- Crear cliente en cada request → overhead
- Variables de entorno faltantes causan error silencioso
- No hay singleton pattern

**Solución requerida:**
\`\`\`typescript
// lib/supabase-server.ts (singleton)
let supabaseInstance: SupabaseClient | null = null

export function getSupabaseServer() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return supabaseInstance
}
\`\`\`

**Riesgo:** MEDIO - Funciona pero no es óptimo

---

### 5. **Validación de UUID en Token**

**Descripción:**
El token ahora es el UUID directo. Si alguien pasa un UUID inválido o inexistente, la API falla.

**Escenario:**
\`\`\`
Usuario modifica URL: ?token=123-fake-uuid
Frontend llama: GET /api/onboarding/123-fake-uuid
Backend busca en BD: no encuentra nada
Retorna 404: "Onboarding no encontrado"
\`\`\`

**Riesgos:**
- Usuario ve error genérico
- No hay tracking de intentos inválidos
- Posible scanning de UUIDs válidos (aunque difícil)

**Solución requerida:**
\`\`\`typescript
// Validar formato UUID antes de consultar BD
import { validate as isValidUUID } from 'uuid'

if (!isValidUUID(id)) {
  return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 400 })
}
\`\`\`

**Riesgo:** BAJO - Más un tema de UX que de pérdida de datos

---

### 6. **Navegación Atrás Elimina Historial Irreversiblemente**

**Descripción:**
Cuando usuario presiona "Atrás", se elimina el último paso del historial. Si fue un error, no puede volver hacia adelante.

**Código en prompt:**
\`\`\`typescript
const handlePrev = useCallback(async () => {
  const newHistory = navigationHistory.slice(0, -1)  // Elimina último paso
  setNavigationHistory(newHistory)
  // ...
}, [navigationHistory])
\`\`\`

**Escenario:**
\`\`\`
Usuario está en: [0, 1, 2, 3, 4, 5, 6, 10]  paso=10
Presiona "Atrás": [0, 1, 2, 3, 4, 5, 6]     paso=6
Presiona "Atrás": [0, 1, 2, 3, 4, 5]        paso=5
¡Ups! Quería volver a paso 10 pero ahora perdió el historial de 6→10
\`\`\`

**Consecuencia:**
- No hay "Rehacer" (forward navigation)
- Usuario debe recorrer todos los pasos nuevamente

**Solución requerida:**
Implementar historial completo con índice:
\`\`\`typescript
const [fullHistory, setFullHistory] = useState([0])
const [historyIndex, setHistoryIndex] = useState(0)

// Atrás: solo decrementa índice
const handlePrev = () => {
  if (historyIndex > 0) {
    setHistoryIndex(historyIndex - 1)
    setCurrentStep(fullHistory[historyIndex - 1])
  }
}

// Adelante: incrementa índice
const handleForward = () => {
  if (historyIndex < fullHistory.length - 1) {
    setHistoryIndex(historyIndex + 1)
    setCurrentStep(fullHistory[historyIndex + 1])
  }
}
\`\`\`

**Riesgo:** MEDIO - UX mejorable pero no pierde datos permanentes

---

## 🟡 RIESGOS MEDIOS

### 7. **Webhook Fire-and-Forget sin Confirmación**

**Descripción:**
El prompt indica que sendProgressWebhook es "fire-and-forget", no espera respuesta.

**Código:**
\`\`\`typescript
fetch('/api/submit-to-zoho', {
  method: 'POST',
  body: JSON.stringify(payload)
}).catch(console.error)  // Solo log, no bloquea
\`\`\`

**Riesgos:**
- Si Zoho Flow falla, no hay retry
- Usuario no sabe si el webhook se envió correctamente
- No hay trazabilidad de webhooks fallidos

**Solución requerida:**
\`\`\`typescript
// Agregar tabla de webhooks
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id UUID REFERENCES onboardings(id),
  tipo TEXT, -- 'progreso' | 'completado'
  payload JSONB,
  enviado_at TIMESTAMP DEFAULT NOW(),
  estado TEXT, -- 'enviado' | 'fallido' | 'reintentando'
  intentos INTEGER DEFAULT 1,
  ultimo_error TEXT
);

// Implementar cola de reintentos
\`\`\`

**Riesgo:** MEDIO - Problema de observabilidad, no de pérdida de datos

---

### 8. **Auto-Save Agresivo: Demasiados Writes**

**Descripción:**
Auto-save cada 5 segundos + guardar en cada paso = muchas escrituras en BD.

**Cálculo:**
- Usuario tarda 30 minutos en completar onboarding
- Auto-save: 360 writes (1 cada 5s)
- Cambios de paso: ~15 writes
- **Total: ~375 writes para un solo onboarding**

**Riesgos:**
- Costo de Supabase por writes
- Consumo de conexiones
- Logs enormes

**Solución:**
\`\`\`typescript
// Auto-save inteligente: solo si hay cambios
let lastSavedData = JSON.stringify(formData)

const interval = setInterval(() => {
  const currentData = JSON.stringify(formData)
  if (currentData !== lastSavedData) {
    saveToDatabase()
    lastSavedData = currentData
  }
}, 5000)
\`\`\`

**Riesgo:** BAJO - Funcional pero costoso

---

### 9. **Falta de Indicador de "Guardado"**

**Descripción:**
El prompt no incluye feedback visual de cuándo se guarda.

**UX Problem:**
\`\`\`
Usuario escribe datos...
// ¿Se guardó? No hay feedback
Usuario cierra navegador esperando que se guardó
\`\`\`

**Solución requerida:**
\`\`\`typescript
const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null)

// Auto-save con feedback
const saveToDatabase = async () => {
  setSaveStatus('saving')
  try {
    await fetch('/api/onboarding/id', {...})
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus(null), 2000)
  } catch (error) {
    setSaveStatus('error')
  }
}

// UI: mostrar "Guardando..." o "✓ Guardado"
\`\`\`

**Riesgo:** BAJO - UX mejorable

---

### 10. **Estado 'completado' sin Validación Completa**

**Descripción:**
handleFinalizar marca el onboarding como 'completado' pero solo valida empresa y admins.

**Escenario:**
\`\`\`typescript
const handleFinalizar = async () => {
  // ¿Validación completa de todos los datos?
  // ¿Qué pasa si hay datos inconsistentes?
  
  await supabase.update({
    estado: 'completado',
    fecha_completado: NOW()
  })
}
\`\`\`

**Riesgos:**
- Onboarding marcado como completo con datos incompletos
- Zoho recibe datos parciales
- No se puede "reabrir" onboarding después

**Solución requerida:**
\`\`\`typescript
const validateAllData = (formData: OnboardingFormData): boolean => {
  // Validar empresa (obligatorio)
  if (!validateEmpresaFields(formData.empresa)) return false
  
  // Validar admins (obligatorio, mínimo 1)
  if (!validateAdminsFields(formData.admins)) return false
  
  // Si configuró turnos, validar consistencia
  if (formData.configureNow && formData.turnos.length > 0) {
    // Validar que planificaciones referencien turnos existentes
    // Validar que asignaciones referencien trabajadores y planificaciones
  }
  
  return true
}

const handleFinalizar = async () => {
  if (!validateAllData(formData)) {
    toast.error('Hay datos incompletos o inconsistentes')
    return
  }
  // ...
}
\`\`\`

**Riesgo:** MEDIO - Problema de integridad de datos

---

## 🟢 RIESGOS BAJOS

### 11. **Límites de JSONB en Supabase**

**Descripción:**
Supabase/PostgreSQL JSONB tiene límite de ~255MB por campo.

**Escenario extremo:**
- Usuario carga 10,000 trabajadores
- Cada trabajador: ~200 bytes
- Total: 2MB ✅ Muy por debajo del límite

**Riesgo:** MUY BAJO - Poco probable

---

### 12. **No Hay TTL (Time To Live) para Onboardings Abandonados**

**Descripción:**
Onboardings con estado 'pendiente' o 'en_progreso' se quedan en BD para siempre.

**Consecuencia:**
- BD crece sin límite
- Costo de almacenamiento

**Solución:**
\`\`\`sql
-- Job automático para limpiar onboardings viejos
DELETE FROM onboardings 
WHERE estado != 'completado' 
AND fecha_ultima_actualizacion < NOW() - INTERVAL '30 days';
\`\`\`

**Riesgo:** BAJO - Problema de housekeeping

---

## RESUMEN DE RIESGOS

| Riesgo | Severidad | Probabilidad | Impacto en Datos | Requiere Fix |
|--------|-----------|--------------|------------------|--------------|
| 1. Race condition auto-save | 🔴 Crítico | Media | Pérdida parcial | ✅ Sí |
| 2. Merge con arrays eliminados | 🔴 Crítico | Alta | No se pueden eliminar items | ✅ Sí |
| 3. Estado desactualizado callbacks | 🔴 Crítico | Media | Pérdida parcial | ✅ Sí |
| 4. Conexión Supabase múltiple | 🟠 Alto | Baja | Fallas de conexión | ⚠️ Recomendado |
| 5. Validación UUID | 🟠 Alto | Media | Error UX | ⚠️ Recomendado |
| 6. Historial sin "Adelante" | 🟠 Alto | Alta | UX pobre | ⚠️ Recomendado |
| 7. Webhooks sin retry | 🟡 Medio | Media | Sin observabilidad | 🔵 Opcional |
| 8. Auto-save agresivo | 🟡 Medio | Alta | Costos | 🔵 Opcional |
| 9. Sin indicador guardado | 🟡 Medio | Alta | UX confusa | 🔵 Opcional |
| 10. Validación incompleta | 🟡 Medio | Media | Datos inconsistentes | ⚠️ Recomendado |
| 11. Límites JSONB | 🟢 Bajo | Muy baja | N/A | ❌ No |
| 12. Sin TTL | 🟢 Bajo | Baja | Costos | 🔵 Opcional |

---

## RECOMENDACIONES PARA EL PROMPT

### Fixes Obligatorios (antes de implementar):

1. **Agregar sistema de cancelación de auto-save** al hacer guardado manual
2. **Implementar metadata de intención** para diferenciar arrays vacíos legítimos
3. **Usar refs en callbacks** para evitar closures desactualizadas
4. **Validación completa** antes de marcar como 'completado'

### Mejoras Recomendadas:

5. Singleton pattern para cliente Supabase
6. Validación de formato UUID
7. Historial con índice (forward/backward navigation)
8. Auto-save inteligente (solo si hay cambios)

### Nice to Have:

9. Indicador visual de guardado
10. Sistema de retry para webhooks
11. TTL para onboardings abandonados

---

## CONCLUSIÓN

El nuevo sistema es **mucho mejor** que el actual, pero tiene **3 riesgos críticos** que deben resolverse antes de implementar:

1. Race conditions entre auto-save y guardado manual
2. Imposibilidad de eliminar el último item de arrays
3. Estado desactualizado en callbacks de React

Con estos fixes, el sistema será robusto y confiable.
