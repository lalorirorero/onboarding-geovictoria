# ESTRUCTURA JSON: datos_actuales en Base de Datos

## REGLA FUNDAMENTAL

**La estructura del JSON SIEMPRE es la misma, sin importar qué tan completo o vacío esté.**

Esto significa:
- ✅ Todos los campos siempre existen
- ✅ Arrays vacíos se representan como `[]`, no como `null` o ausentes
- ✅ Booleanos siempre tienen valor (`true` o `false`)
- ✅ Strings vacíos se representan como `""`, no como `null`

---

## ESTRUCTURA BASE (SIEMPRE IGUAL)

\`\`\`json
{
  "formData": {
    "empresa": {
      "razonSocial": "",
      "nombreFantasia": "",
      "rut": "",
      "giro": "",
      "direccion": "",
      "comuna": "",
      "emailFacturacion": "",
      "telefonoContacto": "",
      "sistema": [],
      "rubro": "",
      "grupos": [],
      "id_zoho": null
    },
    "admins": [],
    "trabajadores": [],
    "turnos": [],
    "planificaciones": [],
    "asignaciones": [],
    "configureNow": false,
    "loadWorkersNow": false
  },
  "navigationHistory": [0],
  "currentStep": 0
}
\`\`\`

---

## EVOLUCIÓN DEL JSON EN EL FLUJO

### 1. CREACIÓN INICIAL (CRM envía datos)

**Endpoint:** `POST /api/generate-link`

**JSON guardado en BD:**
\`\`\`json
{
  "formData": {
    "empresa": {
      "razonSocial": "Empresa Demo SpA",
      "nombreFantasia": "Demo",
      "rut": "76.123.456-7",
      "giro": "Servicios de tecnología",
      "direccion": "Av. Principal 123",
      "comuna": "Santiago",
      "emailFacturacion": "facturacion@demo.cl",
      "telefonoContacto": "+56912345678",
      "sistema": [],              // Vacío - usuario lo llenará
      "rubro": "",                // Vacío - usuario lo llenará
      "grupos": [],               // Vacío - se crea con admins
      "id_zoho": "12345678"       // Del CRM
    },
    "admins": [],                 // Vacío - usuario agregará
    "trabajadores": [],           // Vacío - usuario agregará
    "turnos": [],                 // Vacío - usuario agregará
    "planificaciones": [],        // Vacío - usuario agregará
    "asignaciones": [],           // Vacío - usuario agregará
    "configureNow": false,
    "loadWorkersNow": false
  },
  "navigationHistory": [0],
  "currentStep": 0
}
\`\`\`

---

### 2. USUARIO ABRE LINK (Primera vez)

**Endpoint:** `GET /api/onboarding/[id]`

**Respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "empresa": {
      "razonSocial": "Empresa Demo SpA",  // Prellenado del CRM
      "nombreFantasia": "Demo",           // Prellenado del CRM
      "rut": "76.123.456-7",             // Prellenado del CRM
      // ... resto prellenado
      "sistema": [],                      // Vacío
      "rubro": "",                        // Vacío
      "grupos": []                        // Vacío
    },
    "admins": [],
    "trabajadores": [],
    "turnos": [],
    "planificaciones": [],
    "asignaciones": [],
    "configureNow": false,
    "loadWorkersNow": false
  },
  "navigationHistory": [0],
  "lastStep": 0
}
\`\`\`

---

### 3. USUARIO COMPLETA EMPRESA Y PRESIONA "SIGUIENTE" (Paso 2 → 3)

**Endpoint:** `PATCH /api/onboarding/[id]`

**Body enviado desde frontend:**
\`\`\`json
{
  "formData": {
    "empresa": {
      "razonSocial": "Empresa Demo SpA",
      "nombreFantasia": "Demo",
      "rut": "76.123.456-7",
      "giro": "Servicios de tecnología",
      "direccion": "Av. Principal 123",
      "comuna": "Santiago",
      "emailFacturacion": "facturacion@demo.cl",
      "telefonoContacto": "+56912345678",
      "sistema": ["Control de Asistencia", "Gestión de Turnos"],  // ← LLENADO
      "rubro": "Tecnología",                                       // ← LLENADO
      "grupos": [                                                  // ← CREADO
        {
          "id": 1,
          "nombre": "Administradores",
          "descripcion": "Grupo administrativo"
        }
      ],
      "id_zoho": "12345678"
    },
    "admins": [],              // Sigue vacío (no llegó a ese paso)
    "trabajadores": [],
    "turnos": [],
    "planificaciones": [],
    "asignaciones": [],
    "configureNow": false,
    "loadWorkersNow": false
  },
  "navigationHistory": [0, 1, 2, 3],  // ← ACTUALIZADO
  "currentStep": 3                     // ← ACTUALIZADO
}
\`\`\`

**Guardado en BD (`datos_actuales`):**
\`\`\`json
{
  "formData": { /* mismo contenido de arriba */ },
  "navigationHistory": [0, 1, 2, 3],
  "currentStep": 3
}
\`\`\`

**Campos actualizados en tabla:**
- `datos_actuales` = JSON completo de arriba
- `ultimo_paso` = 3
- `navigation_history` = [0, 1, 2, 3]
- `estado` = 'en_progreso'
- `fecha_ultima_actualizacion` = NOW()

---

### 4. USUARIO AGREGA 2 ADMINS Y PRESIONA "SIGUIENTE" (Paso 3 → 4)

**Body enviado:**
\`\`\`json
{
  "formData": {
    "empresa": { /* sin cambios */ },
    "admins": [                        // ← LLENADO
      {
        "id": 1,
        "nombre": "Juan",
        "apellido": "Pérez",
        "rut": "12.345.678-9",
        "email": "juan@demo.cl",
        "telefono": "+56987654321",
        "grupoId": "1",
        "grupoNombre": "Administradores"
      },
      {
        "id": 2,
        "nombre": "María",
        "apellido": "González",
        "rut": "98.765.432-1",
        "email": "maria@demo.cl",
        "telefono": "+56912348765",
        "grupoId": "1",
        "grupoNombre": "Administradores"
      }
    ],
    "trabajadores": [],        // Sigue vacío
    "turnos": [],
    "planificaciones": [],
    "asignaciones": [],
    "configureNow": false,
    "loadWorkersNow": false
  },
  "navigationHistory": [0, 1, 2, 3, 4],
  "currentStep": 4
}
\`\`\`

---

### 5. USUARIO ELIGE "CARGAR TRABAJADORES EN CAPACITACIÓN" (Paso 4 → 6)

**Body enviado:**
\`\`\`json
{
  "formData": {
    "empresa": { /* sin cambios */ },
    "admins": [ /* sin cambios - mantiene los 2 admins */ ],
    "trabajadores": [],              // Vacío - decidió no cargar
    "turnos": [],
    "planificaciones": [],
    "asignaciones": [],
    "configureNow": false,
    "loadWorkersNow": false          // ← ACTUALIZADO a false
  },
  "navigationHistory": [0, 1, 2, 3, 4, 6],  // ← Salta de 4 a 6 (omite 5)
  "currentStep": 6
}
\`\`\`

**IMPORTANTE:** Nota que `trabajadores` sigue siendo `[]` pero NO borra los admins.

---

### 6. USUARIO CIERRA NAVEGADOR Y REABRE (Segunda sesión)

**Endpoint:** `GET /api/onboarding/[id]`

**Respuesta (datos guardados en sesión anterior):**
\`\`\`json
{
  "success": true,
  "data": {
    "empresa": {
      "razonSocial": "Empresa Demo SpA",
      "sistema": ["Control de Asistencia", "Gestión de Turnos"],
      "rubro": "Tecnología",
      // ... resto completo
    },
    "admins": [                    // ← MANTIENE los 2 admins de sesión 1
      {
        "id": 1,
        "nombre": "Juan",
        "apellido": "Pérez",
        // ...
      },
      {
        "id": 2,
        "nombre": "María",
        "apellido": "González",
        // ...
      }
    ],
    "trabajadores": [],
    "turnos": [],
    "planificaciones": [],
    "asignaciones": [],
    "configureNow": false,
    "loadWorkersNow": false
  },
  "navigationHistory": [0, 1, 2, 3, 4, 6],
  "lastStep": 6                    // ← Continúa desde aquí
}
\`\`\`

---

### 7. USUARIO PRESIONA "ATRÁS" DESDE PASO 6

**NO se guarda nada en BD**

**Solo actualiza estado local:**
\`\`\`javascript
// Estado local cambia a:
currentStep = 4
navigationHistory = [0, 1, 2, 3, 4]  // Remueve el 6
\`\`\`

**BD no se toca** - Los datos siguen iguales hasta que presione "Siguiente"

---

### 8. USUARIO MODIFICA UN ADMIN Y PRESIONA "SIGUIENTE" (Paso 4 → 6 de nuevo)

**Body enviado:**
\`\`\`json
{
  "formData": {
    "empresa": { /* sin cambios */ },
    "admins": [
      {
        "id": 1,
        "nombre": "Juan Carlos",     // ← MODIFICADO (era "Juan")
        "apellido": "Pérez",
        "rut": "12.345.678-9",
        "email": "juancarlos@demo.cl",  // ← MODIFICADO
        "telefono": "+56987654321",
        "grupoId": "1",
        "grupoNombre": "Administradores"
      },
      {
        "id": 2,
        "nombre": "María",
        // ... sin cambios
      }
    ],
    "trabajadores": [],
    "turnos": [],
    "planificaciones": [],
    "asignaciones": [],
    "configureNow": false,
    "loadWorkersNow": false
  },
  "navigationHistory": [0, 1, 2, 3, 4, 6],  // Vuelve a agregar 6
  "currentStep": 6
}
\`\`\`

**Backend hace merge inteligente:**
\`\`\`javascript
// Compara:
// BD tenía: admins[0].nombre = "Juan"
// Frontend envía: admins[0].nombre = "Juan Carlos"
// Resultado: ACTUALIZA a "Juan Carlos" (dato conocido diferente)
\`\`\`

---

### 9. USUARIO FINALIZA (Paso 10 → 11)

**Body enviado:**
\`\`\`json
{
  "formData": {
    "empresa": { /* completo */ },
    "admins": [ /* 2 admins */ ],
    "trabajadores": [],           // Vacío por decisión
    "turnos": [],                 // Vacío por decisión
    "planificaciones": [],        // Vacío por decisión
    "asignaciones": [],           // Vacío por decisión
    "configureNow": false,
    "loadWorkersNow": false
  },
  "navigationHistory": [0, 1, 2, 3, 4, 6, 10, 11],
  "currentStep": 11
}
\`\`\`

**Campos actualizados en tabla:**
- `datos_actuales` = JSON completo
- `ultimo_paso` = 11
- `navigation_history` = [0, 1, 2, 3, 4, 6, 10, 11]
- `estado` = 'completado'
- `fecha_completado` = NOW()
- `fecha_ultima_actualizacion` = NOW()

---

## BACKEND: FUNCIÓN DE MERGE INTELIGENTE

\`\`\`typescript
function mergeFormData(existing: OnboardingFormData, incoming: OnboardingFormData) {
  return {
    empresa: {
      // Para cada campo de empresa
      razonSocial: incoming.empresa.razonSocial !== "" 
        ? incoming.empresa.razonSocial 
        : existing.empresa.razonSocial,
      
      nombreFantasia: incoming.empresa.nombreFantasia !== "" 
        ? incoming.empresa.nombreFantasia 
        : existing.empresa.nombreFantasia,
      
      // Arrays: actualiza si incoming tiene elementos
      sistema: incoming.empresa.sistema.length > 0 
        ? incoming.empresa.sistema 
        : existing.empresa.sistema,
      
      grupos: incoming.empresa.grupos.length > 0 
        ? incoming.empresa.grupos 
        : existing.empresa.grupos,
      
      // ... resto de campos
    },
    
    // Arrays principales
    admins: incoming.admins.length > 0 
      ? incoming.admins 
      : existing.admins,
    
    trabajadores: incoming.trabajadores.length > 0 
      ? incoming.trabajadores 
      : existing.trabajadores,
    
    turnos: incoming.turnos.length > 0 
      ? incoming.turnos 
      : existing.turnos,
    
    planificaciones: incoming.planificaciones.length > 0 
      ? incoming.planificaciones 
      : existing.planificaciones,
    
    asignaciones: incoming.asignaciones.length > 0 
      ? incoming.asignaciones 
      : existing.asignaciones,
    
    // Booleanos: siempre actualiza (son conocidos)
    configureNow: incoming.configureNow,
    loadWorkersNow: incoming.loadWorkersNow
  }
}
\`\`\`

---

## VALIDACIÓN EN FRONTEND (ANTES DE ENVIAR)

\`\`\`typescript
// En handleNext, antes de PATCH
const dataToSend = {
  formData: formData,  // Estado actual COMPLETO de React
  navigationHistory: navigationHistory,
  currentStep: nextStep
}

// Frontend SIEMPRE envía estructura completa
// NUNCA envía datos parciales o undefined
\`\`\`

---

## RESUMEN DE REGLAS

1. **Estructura siempre igual** - Todos los campos siempre presentes
2. **Arrays vacíos = `[]`** - Nunca `null` o ausentes
3. **Strings vacíos = `""`** - Nunca `null` o ausentes
4. **Frontend envía TODO** - Estructura completa en cada PATCH
5. **Backend hace merge** - Protege datos existentes
6. **Solo guarda en "Siguiente"** - No en auto-save ni "Atrás"
7. **Una fila, múltiples UPDATEs** - Nunca múltiples filas

---

## CASOS ESPECIALES

### ¿Cómo eliminar un admin agregado por error?

**En el frontend:**
\`\`\`typescript
// Usuario elimina admin con id=2
const newAdmins = formData.admins.filter(a => a.id !== 2)
setFormData({ ...formData, admins: newAdmins })
\`\`\`

**Al presionar "Siguiente":**
\`\`\`json
{
  "admins": [
    { "id": 1, "nombre": "Juan", ... }
    // Admin con id=2 ya no está
  ]
}
\`\`\`

**Backend recibe:**
- `incoming.admins.length = 1` (tiene elementos)
- Se considera "dato conocido" (no está vacío por desconocimiento)
- **ACTUALIZA** con el nuevo array (1 admin en vez de 2)

### ¿Cómo distinguir "array vacío intencional" de "array vacío por no visitar paso"?

**Por el contexto del navigationHistory:**
\`\`\`json
// Usuario saltó trabajadores
{
  "navigationHistory": [0, 1, 2, 3, 4, 6],  // No visitó paso 5
  "trabajadores": []  // ← Vacío porque saltó, NO porque eliminó
}

// Usuario visitó trabajadores pero no agregó ninguno
{
  "navigationHistory": [0, 1, 2, 3, 4, 5, 6],  // SÍ visitó paso 5
  "trabajadores": []  // ← Vacío intencionalmente (visitó pero no agregó)
}
\`\`\`

**Merge inteligente considera el historial:**
\`\`\`typescript
function mergeFormData(existing, incoming, incomingHistory) {
  const visitedWorkersStep = incomingHistory.includes(5)
  
  return {
    trabajadores: visitedWorkersStep
      ? incoming.trabajadores  // Visitó paso 5, confiar en el array (aunque esté vacío)
      : (incoming.trabajadores.length > 0 
          ? incoming.trabajadores 
          : existing.trabajadores)
  }
}
\`\`\`

---

## ESTRUCTURA DE LA TABLA EN BD

\`\`\`sql
CREATE TABLE onboardings (
  id UUID PRIMARY KEY,
  id_zoho TEXT NOT NULL,
  estado TEXT CHECK (estado IN ('pendiente', 'en_progreso', 'completado')),
  datos_actuales JSONB NOT NULL,  -- ← El JSON completo de arriba
  ultimo_paso INTEGER,
  navigation_history INTEGER[],
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_ultima_actualizacion TIMESTAMP DEFAULT NOW(),
  fecha_completado TIMESTAMP
);
\`\`\`

**Ejemplo de fila completa:**
\`\`\`
id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
id_zoho: "12345678"
estado: "en_progreso"
datos_actuales: { "formData": {...}, "navigationHistory": [...], "currentStep": 6 }
ultimo_paso: 6
navigation_history: {0,1,2,3,4,6}
fecha_creacion: "2025-01-15 10:00:00"
fecha_ultima_actualizacion: "2025-01-15 10:15:00"
fecha_completado: NULL
