# Guía de Encriptación Zoho CRM ↔ Next.js

Esta guía explica cómo implementar encriptación compatible entre Zoho CRM (usando Deluge) y la aplicación Next.js.

## Método de Encriptación Recomendado

**AES-128 + Base64** - Usa las funciones nativas de Zoho Deluge: `aesEncode128` y `base64encode`

### ⚠️ Funciones Correctas de Zoho Deluge

**Para encriptar (usar estas):**
- ✅ `aesEncode128` - Encriptación AES-128 bidireccional
- ✅ `base64encode` - Codificación Base64 para URL

**NO usar (son unidireccionales o inseguras):**
- ❌ SHA1, SHA256, SHA512, MD5 - Hash unidireccional (no se puede desencriptar)
- ❌ HMAC - Autenticación de mensajes (no encriptación)
- ❌ Solo base64encode - No es encriptación segura

## Variables de Entorno Necesarias

### En Next.js (Vercel)
\`\`\`env
ENCRYPTION_SECRET=tu-clave-secreta-de-32-caracteres-minimo
NEXT_PUBLIC_BASE_URL=https://tu-app.vercel.app
ZOHO_FLOW_TEST_URL=https://flows.zoho.com/do/dev/your-flow-id
\`\`\`

### En Zoho CRM
Crear una variable personalizada en Settings → Developer Space → Variables:
- **Nombre**: `ENCRYPTION_KEY`
- **Valor**: La misma clave secreta usada en `ENCRYPTION_SECRET`

⚠️ **IMPORTANTE**: Ambas claves deben ser idénticas para que funcione la encriptación/desencriptación.

---

## Paso 1: Código Deluge para Encriptar Datos en Zoho CRM

Crea una función personalizada en Zoho CRM (Setup → Functions → Create Function):

### Función: `generateOnboardingLink`

\`\`\`javascript
// Función para generar link de onboarding con datos encriptados
string generateOnboardingLink(string dealId) {
  
  // 1. Obtener datos del Deal
  dealRecord = zoho.crm.getRecordById("Deals", dealId.toLong());
  accountId = dealRecord.get("Account_Name").get("id");
  accountRecord = zoho.crm.getRecordById("Accounts", accountId.toLong());
  
  // 2. Preparar datos para encriptar
  empresaData = Map();
  empresaData.put("razonSocial", accountRecord.get("Account_Name"));
  empresaData.put("nombreFantasia", accountRecord.get("Nombre_Fantasia")); // Campo personalizado
  empresaData.put("rut", accountRecord.get("RUT")); // Campo personalizado
  empresaData.put("giro", accountRecord.get("Giro")); // Campo personalizado
  empresaData.put("direccion", accountRecord.get("Billing_Street"));
  empresaData.put("comuna", accountRecord.get("Billing_City"));
  empresaData.put("email", accountRecord.get("Email_Facturacion")); // Campo personalizado
  empresaData.put("telefono", accountRecord.get("Phone"));
  empresaData.put("rubro", dealRecord.get("Rubro")); // Campo personalizado
  empresaData.put("sistema", dealRecord.get("Sistema_Seleccionado")); // Campo personalizado
  
  // 3. Convertir a JSON
  jsonData = empresaData.toString();
  
  // 4. Obtener clave de encriptación (debe ser la misma que ENCRYPTION_SECRET en Vercel)
  encryptionKey = organization.getVariable("ENCRYPTION_KEY");
  
  // 5. Encriptar usando AES-128 - FUNCIÓN CORRECTA DE ZOHO DELUGE
  encryptedData = zoho.encryption.aesEncode128(jsonData, encryptionKey);
  
  // 6. Codificar en Base64 - FUNCIÓN CORRECTA DE ZOHO DELUGE
  base64Token = zoho.encryption.base64encode(encryptedData);
  
  // 7. Hacer URL-safe (reemplazar caracteres especiales)
  urlSafeToken = base64Token.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  
  // 8. Construir URL completa
  baseUrl = "https://tu-app.vercel.app"; // Cambiar por tu URL real (variable NEXT_PUBLIC_BASE_URL)
  fullLink = baseUrl + "?token=" + urlSafeToken;
  
  // 9. Guardar link en el Deal (campo personalizado)
  updateMap = Map();
  updateMap.put("Onboarding_Link", fullLink);
  zoho.crm.updateRecord("Deals", dealId.toLong(), updateMap);
  
  return fullLink;
}
\`\`\`

### Usar la función en un Workflow o Button

**Opción 1: Workflow Rule (Automático)**
1. Setup → Automation → Workflow Rules → Create Rule
2. Module: Deals
3. When: Record Action → Edit/Create
4. Condition: `Stage` equals "Onboarding"
5. Actions → Custom Functions → Select `generateOnboardingLink`

**Opción 2: Custom Button (Manual)**
1. Setup → Modules → Deals → Links & Buttons
2. Create New Button
3. Name: "Generar Link Onboarding"
4. Function: Call `generateOnboardingLink(${Deals.Id})`

---

## Paso 2: Enviar Link al Cliente

### Por Email (usando Workflow)

\`\`\`javascript
// En el workflow, después de generar el link
dealRecord = zoho.crm.getRecordById("Deals", dealId.toLong());
onboardingLink = dealRecord.get("Onboarding_Link");
contactEmail = dealRecord.get("Contact_Name").get("Email");

// Enviar email
sendmail [
  from: "noreply@tuempresa.com"
  to: contactEmail
  subject: "Completa tu proceso de Onboarding"
  message: "Hola,<br><br>Por favor completa tu proceso de onboarding en el siguiente link:<br><br><a href='" + onboardingLink + "'>Comenzar Onboarding</a><br><br>Saludos,<br>El equipo"
]
\`\`\`

### Por WhatsApp (usando Zoho Flow)

\`\`\`javascript
// Trigger: Workflow llama a Zoho Flow webhook
// Flow envía mensaje de WhatsApp con el link
\`\`\`

---

## Paso 3: Desencriptación en Next.js

La aplicación Next.js ya tiene implementado el sistema de desencriptación automática:

### Cómo funciona:
1. Usuario abre el link: `https://tu-app.vercel.app?token=abc123xyz`
2. El componente `OnboardingTurnos` detecta el parámetro `token`
3. Llama a `/api/decrypt-token` para desencriptar
4. Pre-llena el formulario con los datos del Deal

### Verificar que funciona:
\`\`\`typescript
// Los datos desencriptados se usan automáticamente en el componente
useEffect(() => {
  const token = searchParams.get('token')
  if (token) {
    fetch('/api/decrypt-token', {
      method: 'POST',
      body: JSON.stringify({ token })
    })
    .then(res => res.json())
    .then(data => {
      // Formulario se pre-llena automáticamente
      console.log('Datos desencriptados:', data)
    })
  }
}, [searchParams])
\`\`\`

---

## Paso 4: Enviar Datos de Vuelta a Zoho Flow

Cuando el usuario completa el formulario, los datos se envían automáticamente al webhook de Zoho Flow.

### Configurar Webhook en Zoho Flow

1. **Crear nuevo Flow en Zoho Flow**
   - Trigger: Webhook → Copy webhook URL
   - Paste URL in Vercel env var: `ZOHO_FLOW_TEST_URL`

2. **Mapear datos recibidos**

El webhook recibe este JSON:

\`\`\`json
{
  "empresa": {
    "razonSocial": "EDALTEC LTDA",
    "nombreFantasia": "EDALTEC",
    "rut": "76201998-1",
    "giro": "Comercializadora de equipos",
    "direccion": "Chiloé 5138",
    "comuna": "San Miguel",
    "email": "marcelo.vargas@edaltec.cl",
    "telefono": "56995925655",
    "rubro": "5.- DISTRIBUCIÓN",
    "sistema": ["3.- GeoVictoria APP"]
  },
  "administradores": [
    {
      "nombre": "Juan Pérez",
      "rut": "12345678-9",
      "email": "juan@empresa.cl",
      "telefono": "+56912345678",
      "grupo": "Administración"
    }
  ],
  "trabajadores": [
    {
      "nombre": "Pedro González",
      "rut": "98765432-1",
      "email": "pedro@empresa.cl",
      "telefono": "+56987654321",
      "cargo": "Vendedor",
      "grupo": "Ventas"
    }
  ],
  "configuracionCompleta": true,
  "turnos": [...],
  "grupos": [...],
  "planificaciones": [...],
  "asignaciones": [...],
  "excelFile": {
    "name": "trabajadores_20250107.xlsx",
    "content": "base64string...",
    "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  },
  "completedAt": "2025-01-07T10:30:00.000Z"
}
\`\`\`

3. **Procesar datos en Zoho Flow**

\`\`\`javascript
// Action: Zoho CRM → Update Deal
dealId = input.dealId; // Pasar dealId en el webhook si es necesario
updateMap = Map();

// Actualizar campos del Deal
updateMap.put("Onboarding_Completed", true);
updateMap.put("Onboarding_Date", input.completedAt);
updateMap.put("Total_Trabajadores", input.trabajadores.size());
updateMap.put("Total_Administradores", input.administradores.size());

// Actualizar Deal
zoho.crm.updateRecord("Deals", dealId, updateMap);

// Crear contactos para administradores
for each admin in input.administradores {
  contactMap = Map();
  contactMap.put("First_Name", admin.nombre.split(" ").get(0));
  contactMap.put("Last_Name", admin.nombre.split(" ").get(1));
  contactMap.put("Email", admin.email);
  contactMap.put("Phone", admin.telefono);
  contactMap.put("Account_Name", dealId);
  contactMap.put("Tipo_Contacto", "Administrador");
  
  zoho.crm.createRecord("Contacts", contactMap);
}

// Guardar archivo Excel en Zoho CRM
if (input.excelFile != null) {
  fileContent = zoho.encryption.base64decode(input.excelFile.content);
  zoho.crm.attachFile("Deals", dealId, input.excelFile.name, fileContent);
}
\`\`\`

---

## Seguridad

### ✅ Buenas Prácticas

1. **Clave Secreta**
   - Mínimo 32 caracteres
   - Usar caracteres aleatorios
   - Nunca compartir en repositorios públicos

2. **Tokens**
   - Expiración recomendada: 7-30 días
   - URL-safe encoding
   - Un uso por token (opcional)

3. **Validación**
   - Validar datos antes de guardar
   - Sanitizar inputs del formulario
   - Verificar formato de RUT, email, teléfono

### ⚠️ Limitaciones

- AES-128 en Zoho (no AES-256 directo)
- Token visible en URL (usar HTTPS siempre)
- Sin expiración automática (implementar si es necesario)

---

## Testing

### Test 1: Generar Link desde Zoho CRM
\`\`\`javascript
// En Zoho CRM Developer Console
dealId = "123456789";
link = generateOnboardingLink(dealId);
info link; // Debería mostrar: https://tu-app.vercel.app?token=...
\`\`\`

### Test 1.5: Desencriptar Manualmente en Zoho (para debugging)
\`\`\`javascript
// Para verificar que la encriptación funciona correctamente
encryptionKey = organization.getVariable("ENCRYPTION_KEY");

// Simular datos de empresa
testData = Map();
testData.put("razonSocial", "Test Company");
testData.put("rut", "12345678-9");
jsonData = testData.toString();

// Encriptar
encrypted = zoho.encryption.aesEncode128(jsonData, encryptionKey);
token = zoho.encryption.base64encode(encrypted);
info "Token generado: " + token;

// Desencriptar (para verificar)
decoded = zoho.encryption.base64decode(token);
decrypted = zoho.encryption.aesDecode128(decoded, encryptionKey);
info "Datos desencriptados: " + decrypted;
// Debería mostrar el mismo JSON original
\`\`\`

### Test 2: Desencriptar en Next.js
\`\`\`bash
# Copiar el token del link generado
# Abrir: https://tu-app.vercel.app?token=COPIAR_TOKEN_AQUI
# Verificar que el formulario se pre-llena con datos correctos
\`\`\`

### Test 3: Webhook a Zoho Flow
\`\`\`bash
# Completar el formulario
# Verificar en Zoho Flow que se recibió el webhook
# Verificar en Zoho CRM que se actualizó el Deal
\`\`\`

---

## Troubleshooting

### Error: "Token inválido"
- Verificar que `ENCRYPTION_SECRET` sea idéntico en Zoho y Vercel
- Verificar que el token no se haya modificado (espacios, saltos de línea)

### Error: "Datos no se pre-llenan"
- Verificar en Network tab del navegador la respuesta de `/api/decrypt-token`
- Verificar que los nombres de campos coincidan exactamente

### Error: "Webhook no se recibe"
- Verificar que `ZOHO_FLOW_TEST_URL` esté configurada correctamente
- Verificar en Zoho Flow → History que llegó la solicitud
- Verificar formato JSON del payload

---

## Ejemplo Completo: Flujo End-to-End

1. **Vendedor cierra Deal** → Stage: "Onboarding"
2. **Workflow se activa** → Llama a `generateOnboardingLink()`
3. **Se genera link encriptado** → Guarda en campo `Onboarding_Link`
4. **Email automático al cliente** → Con link personalizado
5. **Cliente abre link** → Formulario pre-llenado con datos del Deal
6. **Cliente completa formulario** → Agrega trabajadores, turnos, etc.
7. **Cliente hace clic en "Completar y enviar"** → Webhook a Zoho Flow
8. **Zoho Flow procesa datos** → Actualiza Deal, crea contactos, adjunta Excel
9. **Vendedor recibe notificación** → "Onboarding completado para Cliente X"

---

## Headers para Llamadas API desde Zoho

Cuando llames a la API desde Zoho CRM o Zoho Flow, solo necesitas el siguiente header:

\`\`\`
Content-Type: application/json
\`\`\`

**NO necesitas** el header `Host` - Zoho lo maneja automáticamente como parámetro del sistema.

### Ejemplo de llamada desde Zoho Deluge:
\`\`\`javascript
// Llamar a la API para generar link
response = invokeurl [
  url: "https://tu-app.vercel.app/api/generate-link"
  type: POST
  headers: {"Content-Type": "application/json"}
  parameters: jsonBody
];
\`\`\`

---

## Contacto y Soporte

Si tienes problemas con la integración:
1. Verificar logs en Vercel Dashboard
2. Verificar ejecución de funciones en Zoho CRM → Setup → Audit Log
3. Verificar historial de Flow en Zoho Flow → History
