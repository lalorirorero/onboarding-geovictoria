# Guía: Generar Links desde Zoho CRM

Esta guía te mostrará cómo configurar Zoho CRM para generar automáticamente links únicos y encriptados para cada Deal que prellenan el formulario de onboarding.

---

## 📋 Requisitos Previos

1. Cuenta de Zoho CRM con permisos de administrador
2. Cuenta de Zoho Flow (incluida en planes de Zoho CRM)
3. Las siguientes variables configuradas en tu aplicación:
   - `NEXT_PUBLIC_BASE_URL` → La URL de tu app
   - `ENCRYPTION_SECRET` → Clave de encriptación
   - `ZOHO_FLOW_TEST_URL` → Webhook de Zoho Flow

---

## 🔧 Configuración en Zoho CRM

### Paso 1: Crear Campos Personalizados en el Módulo "Accounts"

Ve a **Setup → Modules and Fields → Accounts** y agrega estos campos si no existen:

| Campo | Tipo | Nombre API |
|-------|------|-----------|
| Nombre de Fantasía | Single Line | `Trading_Name` |
| RUT/Tax ID | Single Line | `Tax_ID` |
| Giro/Industria | Single Line | `Industry` |
| Email de Facturación | Email | `Billing_Email` |
| Rubro | Picklist | `Industry_Category` |
| Link de Onboarding | URL | `Onboarding_Link` |
| Estado de Onboarding | Picklist | `Onboarding_Status` |

Valores para `Onboarding_Status`:
- Pendiente
- Link Enviado
- En Progreso
- Completado

---

## 🔄 Configuración en Zoho Flow

### Paso 2: Crear un Flow para Generar el Link

1. Ve a **Zoho Flow** (flow.zoho.com)
2. Crea un nuevo flow: **"Generar Link de Onboarding"**
3. Configura el trigger y las acciones:

#### **Trigger: Cuando se crea o actualiza un Account**

\`\`\`
Trigger: Zoho CRM → Record Created/Updated
Module: Accounts
Condition: Onboarding_Status = "Pendiente"
\`\`\`

#### **Acción 1: Generar el Token**

\`\`\`
Action: Webhook → Custom
Method: POST
URL: https://TU-DOMINIO.com/api/generate-link
Headers:
  Content-Type: application/json

Body (JSON):
{
  "empresaData": {
    "razonSocial": ${Accounts.Account_Name},
    "nombreFantasia": ${Accounts.Trading_Name},
    "rut": ${Accounts.Tax_ID},
    "giro": ${Accounts.Industry},
    "direccion": ${Accounts.Billing_Street},
    "comuna": ${Accounts.Billing_City},
    "emailFacturacion": ${Accounts.Billing_Email},
    "telefonoContacto": ${Accounts.Phone},
    "sistema": ["3.- GeoVictoria APP"],
    "rubro": ${Accounts.Industry_Category}
  }
}
\`\`\`

**Nota:** Ajusta los nombres de los campos según tu configuración de Zoho CRM.

#### **Acción 2: Guardar el Link en el Account**

\`\`\`
Action: Zoho CRM → Update Record
Module: Accounts
Record ID: ${Accounts.id}
Fields to Update:
  - Onboarding_Link: ${step2.link}
  - Onboarding_Status: "Link Generado"
\`\`\`

#### **Acción 3: Enviar Email al Cliente**

\`\`\`
Action: Send Email
To: ${Accounts.Billing_Email}
Subject: Completa tu información de onboarding - ${Accounts.Account_Name}
Body:
  Hola,

  Para completar el proceso de onboarding de ${Accounts.Trading_Name}, 
  por favor completa el siguiente formulario:

  ${step2.link}

  Este link es único y tiene tu información prellenada. Solo necesitas 
  completar los datos de tus trabajadores y configurar los turnos.

  Si tienes alguna pregunta, no dudes en contactarnos.

  Saludos,
  Equipo de Onboarding
\`\`\`

---

## 📧 Paso 3: Crear Webhook para Recibir Datos Completados

1. En **Zoho Flow**, crea un nuevo flow: **"Recibir Onboarding Completado"**
2. Selecciona **Trigger: Webhook**
3. Copia la URL del webhook (ejemplo: `https://flow.zoho.com/1234567890/flow/webhook/...`)
4. Pega esta URL en la variable de entorno `ZOHO_FLOW_TEST_URL` de tu aplicación

#### **Acción 1: Actualizar Account en CRM**

\`\`\`
Action: Zoho CRM → Update Record
Module: Accounts
Search by: Tax_ID = ${webhook.formData.empresa.rut}
Fields to Update:
  - Onboarding_Status: "Completado"
  - Account_Name: ${webhook.formData.empresa.razonSocial}
  - Trading_Name: ${webhook.formData.empresa.nombreFantasia}
\`\`\`

#### **Acción 2: Crear Contactos de los Trabajadores**

\`\`\`
Action: Loop → For Each
Items: ${webhook.formData.trabajadores}

Inside Loop:
  Action: Zoho CRM → Create Record
  Module: Contacts
  Fields:
    - Last_Name: ${item.nombre}
    - Email: ${item.correo}
    - Phone: ${item.telefono1}
    - Account_Name: [Link to Account from previous step]
\`\`\`

#### **Acción 3: Notificar al Equipo**

\`\`\`
Action: Send Email
To: ventas@tuempresa.com
Subject: ✅ Onboarding Completado - ${webhook.formData.empresa.nombreFantasia}
Body:
  El cliente ${webhook.formData.empresa.nombreFantasia} ha completado 
  el proceso de onboarding.

  📊 Resumen:
  - RUT: ${webhook.formData.empresa.rut}
  - Trabajadores registrados: ${webhook.formData.trabajadores.length}
  - Fecha de completado: ${webhook.timestamp}

  Puedes revisar los detalles en Zoho CRM.
\`\`\`

---

## 🧪 Paso 4: Probar la Integración

### Prueba Manual desde Zoho CRM:

1. Ve a **Accounts** en Zoho CRM
2. Crea un nuevo Account de prueba con estos datos:
   \`\`\`
   Account Name: Test Company LTDA
   Trading Name: Test Company
   Tax ID: 12345678-9
   Industry: Tecnología
   Billing Street: Av. Principal 123
   Billing City: Santiago
   Billing Email: test@example.com
   Phone: +56912345678
   Industry Category: 5.- DISTRIBUCIÓN
   Onboarding Status: Pendiente
   \`\`\`

3. Guarda el registro
4. El Flow debería ejecutarse automáticamente y:
   - Generar el link encriptado
   - Guardarlo en el campo `Onboarding_Link`
   - Enviar un email a `test@example.com`

5. Abre el link del email
6. Verifica que los campos estén prellenados
7. Completa el formulario
8. Verifica en Zoho CRM que:
   - El estado cambió a "Completado"
   - Se crearon los contactos

---

## 📊 Paso 5: Mapeo de Campos

Estos son los campos que se prellenan automáticamente desde Zoho CRM:

| Campo en Formulario | Campo en Zoho CRM | Ejemplo |
|---------------------|-------------------|---------|
| Razón Social | `Account_Name` | "EDALTEC LTDA" |
| Nombre de Fantasía | `Trading_Name` | "EDALTEC" |
| RUT | `Tax_ID` | "76201998-1" |
| Giro | `Industry` | "Comercializadora..." |
| Dirección | `Billing_Street` | "Chiloé 5138" |
| Comuna | `Billing_City` | "San Miguel" |
| Email Facturación | `Billing_Email` | "marcelo@edaltec.cl" |
| Teléfono | `Phone` | "56995925655" |
| Sistema | Hardcoded | ["3.- GeoVictoria APP"] |
| Rubro | `Industry_Category` | "5.- DISTRIBUCIÓN" |

---

## 🔒 Seguridad

### El sistema de tokens garantiza:

✅ **Datos encriptados** - Nadie puede ver la información en la URL  
✅ **No modificables** - Si alguien intenta cambiar el token, será inválido  
✅ **Únicos por cliente** - Cada Deal genera un token diferente  
✅ **Seguros para compartir** - Puedes enviarlos por email sin riesgo  

### Ejemplo de URL generada:

\`\`\`
https://tu-app.com/?token=02a4b3c8d9e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0...
\`\`\`

La información dentro del token está completamente encriptada.

---

## 📱 Uso en Producción

### Botón en Zoho CRM (Opcional)

Puedes agregar un botón personalizado en cada Account para generar el link manualmente:

1. Ve a **Setup → Modules and Fields → Accounts → Links & Buttons**
2. Crea un nuevo botón:
   \`\`\`
   Label: Generar Link de Onboarding
   Type: Web Service
   URL: [URL del Flow de Zoho]
   Display: Detail Page
   \`\`\`

### Dashboard para Seguimiento

Crea un dashboard en Zoho CRM para monitorear:
- Cantidad de links generados
- Cantidad de onboardings completados
- Tiempo promedio de completado
- Links pendientes de completar

---

## 🐛 Solución de Problemas

### El link no se genera:
- Verifica que `NEXT_PUBLIC_BASE_URL` esté configurado
- Revisa los logs del Flow en Zoho
- Verifica que todos los campos requeridos tengan valores

### Los campos no se prellenan:
- Abre la consola del navegador (F12) y busca errores
- Verifica que el parámetro `?token=` esté en la URL
- Prueba desencriptar manualmente el token llamando a `/api/decrypt-token`

### Los datos no llegan a Zoho:
- Verifica que `ZOHO_FLOW_TEST_URL` esté configurado correctamente
- Prueba el webhook directamente desde Postman
- Revisa los logs del Flow receptor en Zoho

### Error "any is not defined":
- Asegúrate de que el archivo `onboarding-turnos.tsx` tenga extensión `.tsx`, no `.jsx`

---

## 📞 Próximos Pasos

1. ✅ Configurar las variables de entorno
2. ✅ Crear los campos en Zoho CRM
3. ✅ Configurar el Flow para generar links
4. ✅ Configurar el Flow para recibir datos
5. ✅ Probar con un Account de prueba
6. ✅ Desplegar en producción

---

¿Necesitas ayuda con algún paso específico? Consulta la documentación completa en `ZOHO_INTEGRATION.md`
