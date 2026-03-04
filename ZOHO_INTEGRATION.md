# Integración con Zoho CRM y Zoho Flow

Este documento explica cómo usar el sistema completo de integración con Zoho CRM y Zoho Flow, incluyendo tokens seguros para prellenar formularios.

## 🔐 Sistema de Tokens Seguros

El sistema utiliza encriptación AES-GCM para proteger los datos sensibles en los links generados. Esto evita que usuarios maliciosos puedan ver o modificar la información en la URL.

### Ventajas del sistema de tokens:
- ✅ **Seguridad**: Los datos están encriptados, no legibles en la URL
- ✅ **Integridad**: Los datos no pueden ser modificados sin invalidar el token
- ✅ **Simplicidad**: Un solo parámetro `token` en la URL
- ✅ **Privacidad**: Información sensible como RUT y emails protegidos

---

## 1. Generar Link con Token desde Zoho CRM

### Paso 1: Crear función en Zoho Flow para generar el token

En Zoho Flow, crea una función que llame a tu API para generar el token:

\`\`\`javascript
// En Zoho Flow - Custom Function
empresaData = {
  "razonSocial": account.Account_Name,
  "nombreFantasia": account.Trading_Name,
  "rut": account.Tax_ID,
  "giro": account.Industry,
  "direccion": account.Billing_Street,
  "comuna": account.Billing_City,
  "emailFacturacion": account.Billing_Email,
  "telefonoContacto": account.Phone,
  "sistema": ["3.- GeoVictoria APP"],
  "rubro": account.Industry_Category
};

// Llamar a tu API para generar el token
response = invokeUrl [
  url: "https://tu-dominio.com/api/generate-link"
  type: POST
  parameters: {
    "empresaData": empresaData
  }
  headers: {
    "Content-Type": "application/json"
  }
];

// El response contendrá el link con el token
generatedLink = response.get("link");
token = response.get("token");

// Ahora puedes enviar este link por email al cliente
\`\`\`

### Paso 2: Ejemplo de datos para generar token

\`\`\`json
{
  "empresaData": {
    "razonSocial": "EDALTEC LTDA",
    "nombreFantasia": "EDALTEC",
    "rut": "76201998-1",
    "giro": "Comercializadora de equipos de alta tecnología",
    "direccion": "Chiloé 5138",
    "comuna": "San Miguel",
    "emailFacturacion": "marcelo.vargas@edaltec.cl",
    "telefonoContacto": "56995925655",
    "sistema": ["3.- GeoVictoria APP"],
    "rubro": "5.- DISTRIBUCIÓN"
  }
}
\`\`\`

### Paso 3: Link generado

El sistema devolverá un link como:

\`\`\`
https://tu-dominio.com/?token=AaBbCcDdEeFf123456789XyZ...
\`\`\`

Este token contiene todos los datos de la empresa encriptados de forma segura.

---

## 2. Usuario Completa el Formulario

### Flujo del usuario:

1. **Usuario recibe el link** por email desde Zoho CRM
2. **Abre el link** en su navegador
3. **Formulario se carga** con los datos de la empresa prellenados automáticamente
4. **Usuario completa** la información faltante (administradores, trabajadores, turnos, planificaciones)
5. **Usuario hace clic en "Finalizar"** y los datos se envían automáticamente a Zoho Flow

### Campos prellenados automáticamente:
- ✅ Razón Social
- ✅ Nombre de fantasía
- ✅ RUT
- ✅ Giro
- ✅ Dirección
- ✅ Comuna
- ✅ Email de facturación
- ✅ Teléfono de contacto
- ✅ Sistema
- ✅ Rubro

### Campos que el usuario debe completar:
- Administradores del sistema
- Lista de trabajadores
- Definición de turnos
- Planificaciones semanales
- Asignación de planificaciones a trabajadores

---

## 3. Recibir Datos Completados en Zoho Flow

Cuando el usuario finaliza el formulario, los datos se envían automáticamente al webhook configurado en `ZOHO_FLOW_TEST_URL`.

### Estructura de datos recibidos:

\`\`\`json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "formData": {
    "empresa": {
      "razonSocial": "EDALTEC LTDA",
      "nombreFantasia": "EDALTEC",
      "rut": "76201998-1",
      "giro": "Comercializadora de equipos de alta tecnología",
      "direccion": "Chiloé 5138",
      "comuna": "San Miguel",
      "emailFacturacion": "marcelo.vargas@edaltec.cl",
      "telefonoContacto": "56995925655",
      "sistema": ["3.- GeoVictoria APP"],
      "rubro": "5.- DISTRIBUCIÓN",
      "grupos": [
        {
          "id": 1234567890,
          "nombre": "Vendedores",
          "descripcion": "Equipo de ventas"
        }
      ]
    },
    "trabajadores": [
      {
        "id": 1234567891,
        "nombre": "Juan Pérez Gómez",
        "rut": "12345678-9",
        "correo": "juan.perez@empresa.cl",
        "grupoId": 1234567890,
        "telefono1": "+56912345678",
        "telefono2": "",
        "telefono3": "",
        "tipo": "usuario"
      }
    ],
    "step": 6,
    "completedAt": "2025-01-15T10:30:00.000Z"
  }
}
\`\`\`

### Procesar datos en Zoho Flow:

\`\`\`javascript
// En Zoho Flow - Webhook Receiver
empresaData = webhook.formData.empresa;
trabajadoresData = webhook.formData.trabajadores;

// Actualizar el account en Zoho CRM con los datos completados
updateRecord("Accounts", accountId, {
  "Account_Name": empresaData.razonSocial,
  "Trading_Name": empresaData.nombreFantasia,
  "Tax_ID": empresaData.rut,
  "Status": "Onboarding Completed"
});

// Crear contactos para cada trabajador
for each trabajador in trabajadoresData {
  createRecord("Contacts", {
    "Last_Name": trabajador.nombre,
    "Email": trabajador.correo,
    "Phone": trabajador.telefono1,
    "Account_Name": accountId
  });
}

// Enviar notificación al equipo
sendEmail({
  "to": "equipo@tuempresa.com",
  "subject": "Nuevo onboarding completado: " + empresaData.nombreFantasia,
  "body": "El cliente " + empresaData.nombreFantasia + " ha completado el onboarding con " + trabajadoresData.size() + " trabajadores."
});
\`\`\`

---

## 4. Flujo Completo de Integración

\`\`\`
┌─────────────────┐
│   Zoho CRM      │
│  (Nuevo Deal)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Zoho Flow      │
│  Genera Token   │ ──► POST /api/generate-link
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Email al       │
│  Cliente        │ ──► Link: https://app.com/?token=XYZ...
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Usuario abre   │
│  el link        │ ──► Formulario prellenado
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Usuario        │
│  completa info  │ ──► Trabajadores, turnos, etc.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Click en       │
│  "Finalizar"    │ ──► POST a ZOHO_FLOW_TEST_URL
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Zoho Flow      │
│  Procesa datos  │ ──► Actualiza CRM, crea registros
└─────────────────┘
\`\`\`

---

## 5. Variables de Entorno Requeridas

\`\`\`env
# Webhook de Zoho Flow para recibir datos completados
ZOHO_FLOW_TEST_URL=https://flow.zoho.com/1234567890/flow/webhook/...

# Clave secreta para encriptación de tokens (genera una aleatoria)
ENCRYPTION_SECRET=tu-clave-secreta-super-segura-cambiar-en-produccion

# URL base de tu aplicación (para generar links correctos)
NEXT_PUBLIC_BASE_URL=https://tu-dominio.com
\`\`\`

### Generar una clave de encriptación segura:

\`\`\`bash
# En tu terminal
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
\`\`\`

---

## 6. APIs Disponibles

### 6.1 Generar Link con Token

**Endpoint:** `POST /api/generate-link`

**Body:**
\`\`\`json
{
  "empresaData": {
    "razonSocial": "...",
    "nombreFantasia": "...",
    "rut": "..."
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "link": "https://tu-dominio.com/?token=XYZ...",
  "token": "XYZ..."
}
\`\`\`

### 6.2 Desencriptar Token (interno)

**Endpoint:** `POST /api/decrypt-token`

**Body:**
\`\`\`json
{
  "token": "XYZ..."
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "empresaData": {
    "razonSocial": "...",
    "nombreFantasia": "..."
  }
}
\`\`\`

### 6.3 Enviar Datos a Zoho Flow

**Endpoint:** `POST /api/submit-to-zoho`

Este endpoint se llama automáticamente cuando el usuario finaliza el formulario.

---

## 7. Testing

### Probar generación de token:

\`\`\`bash
curl -X POST https://tu-dominio.com/api/generate-link \
  -H "Content-Type: application/json" \
  -d '{
    "empresaData": {
      "razonSocial": "Test Company",
      "nombreFantasia": "Test",
      "rut": "12345678-9"
    }
  }'
\`\`\`

### Probar el botón de prueba:

Usa el botón flotante "TEST ZOHO" en la esquina inferior derecha de la aplicación para probar la conexión con Zoho Flow sin completar todo el formulario.

---

## 8. Seguridad

### ✅ Implementado:
- Encriptación AES-GCM de 256 bits
- Salt aleatorio único por token
- IV (Initialization Vector) aleatorio
- PBKDF2 con 100,000 iteraciones
- Tokens URL-safe (base64 codificado)

### ⚠️ Recomendaciones:
- Usa HTTPS en producción (siempre)
- Cambia `ENCRYPTION_SECRET` a una clave fuerte y única
- No compartas la clave de encriptación
- Considera agregar expiración de tokens si es necesario
- Implementa rate limiting en los endpoints

---

## 9. Troubleshooting

### Token inválido o expirado:
- Verifica que `ENCRYPTION_SECRET` sea la misma en ambos endpoints
- Asegúrate de que el token no esté corrupto o modificado

### Datos no se envían a Zoho Flow:
- Verifica que `ZOHO_FLOW_TEST_URL` esté configurado correctamente
- Prueba el webhook directamente desde Zoho Flow
- Revisa los logs de la aplicación

### Campos no se prellenan:
- Verifica que el parámetro `token` esté en la URL
- Abre la consola del navegador y busca errores
- Verifica que los nombres de los campos coincidan exactamente

---

## 10. Soporte

Para más información o soporte, contacta al equipo de desarrollo.
