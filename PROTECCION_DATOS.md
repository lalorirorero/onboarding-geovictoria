# Sistema de Protección de Datos

Este documento describe el sistema de protección de datos implementado en el onboarding.

## Conceptos Clave

### 1. Datos Prellenados vs Ingresados por Usuario

El sistema distingue entre:

- **Datos prellenados**: Vienen del sistema maestro (Zoho CRM) a través del token encriptado
- **Datos del usuario**: Ingresados manualmente durante el onboarding

### 2. Estados de Protección

#### Campos
- **Bloqueado (prellenado)**: Muestra el valor con indicador visual "Dato de sistema" y botón "Editar"
- **Desbloqueado**: Campo editable normalmente
- **Editado**: Campo que fue modificado por el usuario (muestra badge "Editado")

#### Pasos
- **No completado**: Formulario abierto y editable
- **Completado y bloqueado**: Muestra resumen con botón "Editar este paso"
- **Completado pero desbloqueado**: Formulario abierto con banner de edición

## Flujo de Usuario

### Primera Visita (con token)
1. Usuario abre link con token encriptado
2. Datos de empresa se precargan desde el token
3. Campos prellenados se muestran bloqueados con indicador visual
4. Usuario puede:
   - Confirmar datos y avanzar
   - Hacer clic en "Editar" para modificar un campo específico

### Volver a un Paso Completado
1. Usuario navega a un paso que ya completó
2. El paso se muestra en modo resumen (datos visibles pero no editables)
3. Usuario puede hacer clic en "Editar este paso" para desbloquear
4. Al terminar de editar, puede hacer clic en "Confirmar cambios"

### Envío Final
El payload enviado a Zoho Flow incluye:

\`\`\`json
{
  "formData": { ... todos los datos ... },
  "protection": {
    "unchangedPrefilledFields": ["razonSocial", "rut", ...],
    "editedPrefilledFields": [
      {
        "field": "emailFacturacion",
        "originalValue": "original@email.com",
        "newValue": "nuevo@email.com"
      }
    ],
    "userInputFields": ["campo1", "campo2", ...]
  }
}
\`\`\`

## Componentes

### ProtectedField
Campo individual con protección. Props:
- `isPrefilled`: Si el valor viene del sistema maestro
- `wasEdited`: Si el usuario lo modificó
- `readOnly`: Si está en modo solo lectura (paso bloqueado)
- `onUnlock`: Callback cuando el usuario desbloquea para editar

### ProtectedStepWrapper
Envuelve un paso completo. Props:
- `isCompleted`: Si el paso fue completado
- `isLocked`: Si está bloqueado (modo resumen)
- `onUnlock`: Callback para desbloquear
- `summaryData`: Datos para mostrar en el resumen

## Hook useDataProtection

\`\`\`typescript
const {
  // Verificaciones
  isFieldPrefilled,
  isFieldEdited,
  isStepLocked,
  isStepCompleted,
  
  // Acciones
  trackFieldChange,
  completeStep,
  unlockStep,
  relockStep,
  
  // Para envío final
  getChangesSummary,
  prepareFinalSubmission,
} = useDataProtection({ prefilledData, onboardingId })
\`\`\`

## Integración con Zoho Flow

En Zoho Flow, puedes procesar la información de protección:

\`\`\`javascript
// Verificar si hubo cambios en datos prellenados
if (payload.protection.editedPrefilledFields.length > 0) {
  // Notificar al equipo comercial sobre cambios
  for each edit in payload.protection.editedPrefilledFields {
    info "Campo: " + edit.field;
    info "Valor original: " + edit.originalValue;
    info "Valor nuevo: " + edit.newValue;
  }
}
