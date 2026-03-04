# ANÁLISIS DE APIS Y SERVICIOS ACTUALES
## Detección de Conflictos con Sistema de Persistencia

**Fecha de análisis:** Diciembre 2024  
**Objetivo:** Identificar posibles conflictos entre el sistema actual de tokenización y el nuevo sistema de persistencia con base de datos.

---

## 1. SISTEMA ACTUAL - ARQUITECTURA EXISTENTE

### APIs Implementadas

#### 1.1. POST /api/generate-link
**Función:** Genera un token encriptado con datos prellenados de la empresa

**Input:**
\`\`\`json
{
  "id_zoho": "string",
  "empresa": {
    "razonSocial": "string",
    "nombreFantasia": "string",
    "rut": "string",
    "giro": "string",
    // ... otros campos
  },
  "admins": [],
  "trabajadores": [],
  "turnos": [],
  "planificaciones": [],
  "asignaciones": []
}
\`\`\`

**Output:**
\`\`\`json
{
  "success": true,
  "link": "https://ejemplo.com?token=XXXXX",
  "token": "XXXXX"
}
\`\`\`

**Proceso actual:**
1. Recibe datos completos del CRM (empresa + arrays opcionales)
2. Serializa TODO en un objeto `dataToEncrypt`
3. Usa `encryptToken()` de `lib/backend.ts` para encriptar TODOS los datos
4. Devuelve token que CONTIENE todos los datos

**⚠️ CONFLICTO POTENCIAL:**
- El token actual contiene TODOS los datos encriptados
- El nuevo sistema requiere que el token solo contenga el ID del registro en BD
- **CAMBIO REQUERIDO:** Modificar para que primero cree el registro en BD, luego encripte solo el ID

---

#### 1.2. POST /api/decrypt-token
**Función:** Desencripta un token y devuelve los datos de la empresa

**Input:**
\`\`\`json
{
  "token": "string"
}
\`\`\`

**Output:**
\`\`\`json
{
  "success": true,
  "empresaData": {
    "id_zoho": "string",
    "razonSocial": "string",
    // ... todos los datos que estaban en el token
  }
}
\`\`\`

**Proceso actual:**
1. Recibe token con TODOS los datos encriptados
2. Usa `decryptToken()` de `lib/backend.ts`
3. Devuelve objeto completo con todos los datos

**⚠️ CONFLICTO POTENCIAL:**
- Actualmente desencripta y devuelve datos directamente del token
- El nuevo sistema requiere: desencriptar ID → consultar BD → devolver datos
- **CAMBIO REQUERIDO:** Esta API puede volverse obsoleta o cambiar a solo validar el token y devolver el ID

---

#### 1.3. POST /api/submit-to-zoho
**Función:** Envía datos finales a Zoho Flow y genera Excel

**Input:**
\`\`\`typescript
{
  accion: "progreso" | "completado",
  eventType: "progress" | "complete",
  id_zoho: string | null,
  formData: OnboardingFormData,
  metadata: {...},
  excelFile: null
}
\`\`\`

**Output:**
\`\`\`json
{
  "success": true,
  "data": "respuesta de Zoho"
}
\`\`\`

**Proceso actual:**
1. Recibe payload con formData completo
2. Si es `eventType: "complete"`, genera Excel con XLSX
3. Agrega el Excel al payload como base64
4. Envía a Zoho Flow usando `sendToZohoFlow()`

**✅ COMPATIBLE:**
- Esta API NO tiene conflictos con el nuevo sistema
- Solo necesita que se le pase el formData actual
- El prompt ya contempla modificarla para generar Excel SIEMPRE (no solo en complete)

---

### Funciones en lib/backend.ts

#### 1.4. encryptToken(empresaData: EmpresaData)
**Función:** Encripta datos completos usando AES-GCM

**Proceso:**
1. Serializa el objeto empresaData a JSON
2. Usa PBKDF2 + AES-GCM con salt e IV aleatorios
3. Devuelve token en base64 URL-safe

**⚠️ CONFLICTO POTENCIAL:**
- Actualmente encripta objeto completo (empresa + arrays)
- Nuevo sistema debe encriptar solo `{ id: "uuid" }`
- **CAMBIO REQUERIDO:** La función puede mantenerse igual, pero se le pasará un objeto más pequeño

---

#### 1.5. decryptToken(token: string)
**Función:** Desencripta token y devuelve objeto EmpresaData

**⚠️ CONFLICTO POTENCIAL:**
- Devuelve EmpresaData completo desde el token
- Nuevo sistema debe devolver solo ID para luego consultar BD
- **CAMBIO REQUERIDO:** Debe devolver `{ id: string }` en lugar de EmpresaData

---

#### 1.6. sendToZohoFlow(payload: ZohoPayload)
**Función:** Envía payload a Zoho Flow webhook

**✅ COMPATIBLE:**
- NO necesita cambios
- Seguirá funcionando igual con el nuevo sistema

---

#### 1.7. sendProgressWebhook(params)
**Función:** Envía webhooks de progreso (fire-and-forget)

**✅ COMPATIBLE:**
- NO necesita cambios estructurales
- Solo necesita recibir formData actualizado cuando se llame

---

## 2. CONFLICTOS IDENTIFICADOS

### CONFLICTO #1: Token contiene datos vs Token contiene ID
**Descripción:**
- **Sistema actual:** Token = datos completos encriptados
- **Sistema nuevo:** Token = solo ID del registro en BD

**Impacto:**
- `/api/generate-link` debe cambiar completamente su flujo
- `/api/decrypt-token` debe cambiar para consultar BD en lugar de devolver datos del token
- Las funciones `encryptToken` y `decryptToken` cambiarán el tipo de datos que manejan

**Solución:**
\`\`\`typescript
// ANTES (actual)
const dataToEncrypt = { /* todos los datos */ }
const token = await encryptToken(dataToEncrypt)

// DESPUÉS (nuevo)
const { data: onboarding } = await supabase.from('onboardings').insert({...})
const token = await encryptToken({ id: onboarding.id }) // Solo el ID
\`\`\`

---

### CONFLICTO #2: Desencriptación devuelve datos completos vs devuelve ID
**Descripción:**
- **Sistema actual:** `decryptToken()` devuelve objeto EmpresaData completo
- **Sistema nuevo:** `decryptToken()` debe devolver solo `{ id: string }`

**Impacto:**
- El frontend actualmente llama a `/api/decrypt-token` y espera recibir empresaData
- Con el nuevo sistema, debe hacer: desencriptar → obtener ID → consultar `/api/onboarding/[id]`

**Solución:**
\`\`\`typescript
// ANTES (actual - en frontend)
const response = await fetch('/api/decrypt-token', { body: { token } })
const { empresaData } = await response.json()
loadDataFromPrefill(empresaData)

// DESPUÉS (nuevo - en frontend)
const decrypted = await decryptToken(token) // { id: "uuid" }
const response = await fetch(`/api/onboarding/${decrypted.id}`)
const { data } = await response.json()
loadDataFromPrefill(data)
\`\`\`

---

### CONFLICTO #3: Tipos TypeScript incompatibles
**Descripción:**
- `EmpresaData` en `lib/backend.ts` tiene estructura diferente a `OnboardingFormData` del componente
- El nuevo sistema usará solo `OnboardingFormData`

**Impacto:**
- Puede causar errores de tipos al migrar
- Necesitamos unificar o eliminar `EmpresaData`

**Solución:**
- Usar solo `OnboardingFormData` en todo el sistema
- Eliminar o deprecar `EmpresaData`

---

## 3. MIGRACIÓN RECOMENDADA

### Estrategia: Migración Gradual (Compatibilidad Temporal)

#### FASE 1: Crear nuevas APIs sin romper las actuales
✅ Crear `/api/onboarding/[id]/route.ts` (GET y PATCH)
✅ Mantener `/api/generate-link` y `/api/decrypt-token` funcionando
✅ Agregar lógica de detección: "¿es token viejo o nuevo?"

#### FASE 2: Modificar flujo de generación
✅ Modificar `/api/generate-link` para crear registro en BD + generar token con ID
✅ Tokens antiguos seguirán funcionando (contienen datos completos)
✅ Tokens nuevos contendrán solo ID

#### FASE 3: Actualizar frontend
✅ Modificar `useEffect` de inicialización para usar nuevo flujo
✅ Mantener compatibilidad con tokens antiguos

#### FASE 4: Deprecar sistema antiguo (después de período de prueba)
✅ Eliminar `/api/decrypt-token` (ya no se usa)
✅ Simplificar `encryptToken` y `decryptToken` para trabajar solo con IDs

---

## 4. CÓDIGO SUGERIDO PARA COMPATIBILIDAD

### 4.1. Detección de tipo de token en el frontend

\`\`\`typescript
// En components/onboarding-turnos.tsx
useEffect(() => {
  const initializeData = async () => {
    const token = new URLSearchParams(window.location.search).get("token")
    if (!token) return

    // Desencriptar token
    const decrypted = await decryptToken(token)
    
    // Detectar si es token viejo (contiene datos) o nuevo (contiene ID)
    if (decrypted.id && !decrypted.razonSocial) {
      // TOKEN NUEVO: Solo tiene ID
      const response = await fetch(`/api/onboarding/${decrypted.id}`)
      const { data, navigationHistory, lastStep } = await response.json()
      loadDataFromPrefill(data)
      setNavigationHistory(navigationHistory)
      setCurrentStep(lastStep)
    } else {
      // TOKEN VIEJO: Contiene todos los datos
      loadDataFromPrefill(decrypted)
      setCurrentStep(0)
      setNavigationHistory([0])
    }
  }
  
  initializeData()
}, [])
\`\`\`

### 4.2. Modificación de /api/generate-link con compatibilidad

\`\`\`typescript
// app/api/generate-link/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json()
  
  // NUEVO: Crear registro en BD
  const { data: onboarding } = await supabase
    .from('onboardings')
    .insert({
      id_zoho: String(body.id_zoho),
      estado: 'pendiente',
      datos_actuales: {
        formData: body,
        navigationHistory: [0],
        currentStep: 0
      },
      // ...
    })
    .select()
    .single()
  
  // NUEVO: Encriptar solo el ID
  const token = await encryptToken({ id: onboarding.id })
  const link = `${BASE_URL}?token=${token}`
  
  return NextResponse.json({ success: true, link, token })
}
\`\`\`

---

## 5. CHECKLIST DE VALIDACIÓN

Antes de implementar el sistema de persistencia, verificar:

- [ ] ¿Supabase está configurado y conectado?
- [ ] ¿La tabla `onboardings` está creada con el esquema correcto?
- [ ] ¿Las variables de entorno de Supabase están configuradas?
- [ ] ¿Se mantiene compatibilidad con tokens antiguos durante migración?
- [ ] ¿Los tipos TypeScript están unificados (OnboardingFormData)?
- [ ] ¿El navigationHistory se guarda correctamente en cada cambio?
- [ ] ¿El auto-save cada 5 segundos no causa problemas de rendimiento?
- [ ] ¿Los webhooks a Zoho siguen funcionando con la nueva estructura?
- [ ] ¿El Excel se genera correctamente en progreso y completado?

---

## 6. RIESGOS Y MITIGACIONES

### RIESGO #1: Tokens antiguos dejen de funcionar
**Probabilidad:** Alta  
**Impacto:** Crítico - usuarios con links antiguos no podrán acceder

**Mitigación:**
- Implementar detección de tipo de token (ID vs datos completos)
- Mantener ambos flujos funcionando durante período de transición
- Notificar a CRM para regenerar links después de migración

### RIESGO #2: Pérdida de datos durante auto-save
**Probabilidad:** Media  
**Impacto:** Alto - usuario pierde progreso si falla el guardado

**Mitigación:**
- Auto-save debe ser fire-and-forget (no bloqueante)
- Mantener estado local como fallback
- Agregar logs de éxito/error de auto-save
- Mostrar indicador visual de "guardando..." si es necesario

### RIESGO #3: Conflictos de tipos TypeScript
**Probabilidad:** Alta  
**Impacto:** Medio - errores en compilación

**Mitigación:**
- Unificar tipos antes de migrar
- Usar `OnboardingFormData` como tipo único
- Deprecar `EmpresaData` gradualmente

### RIESGO #4: Webhooks duplicados o perdidos
**Probabilidad:** Media  
**Impacto:** Medio - Zoho recibe datos incorrectos

**Mitigación:**
- Mantener webhooks como fire-and-forget
- Agregar ID único de webhook para deduplicación en Zoho
- Logs detallados de cada envío

---

## 7. CONCLUSIÓN

### ✅ APIS COMPATIBLES (No requieren cambios críticos)
- `/api/submit-to-zoho` - Solo necesita generar Excel siempre
- `sendToZohoFlow()` - Sigue igual
- `sendProgressWebhook()` - Sigue igual

### ⚠️ APIS QUE REQUIEREN MODIFICACIÓN
- `/api/generate-link` - CAMBIO MAYOR: crear en BD + encriptar ID
- `/api/decrypt-token` - PUEDE DEPRECARSE o cambiar a validación simple
- `encryptToken()` - Cambia el tipo de datos que encripta
- `decryptToken()` - Cambia el tipo de datos que devuelve

### 🆕 APIS NUEVAS A CREAR
- `GET /api/onboarding/[id]` - Obtener datos desde BD
- `PATCH /api/onboarding/[id]` - Auto-save y navegación

### 📋 RECOMENDACIÓN FINAL

**IMPLEMENTAR CON COMPATIBILIDAD GRADUAL:**

1. Crear nuevas APIs primero
2. Modificar `/api/generate-link` para crear en BD
3. Actualizar frontend para detectar tipo de token
4. Período de prueba de 1-2 semanas
5. Deprecar APIs antiguas cuando todos los tokens sean nuevos

**ORDEN DE IMPLEMENTACIÓN SUGERIDO:**

1. ✅ Configurar Supabase y crear tabla
2. ✅ Crear `/api/onboarding/[id]` (GET y PATCH)
3. ✅ Modificar `/api/generate-link` con detección de nuevo sistema
4. ✅ Actualizar frontend con detección de tipo de token
5. ✅ Agregar auto-save y navigationHistory
6. ✅ Probar completamente con datos reales
7. ✅ Monitorear por 1 semana
8. ✅ Deprecar sistema antiguo

---

**Documento creado por:** v0  
**Última actualización:** Diciembre 2024
