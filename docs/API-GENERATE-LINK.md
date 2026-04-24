# API de Generación de Links con Token

## Descripción

Esta API permite generar links únicos de onboarding con datos pre-llenados para facilitar el proceso de configuración inicial de nuevos clientes. Cada link contiene un token que identifica de manera única la sesión de onboarding en la base de datos.

---

## Endpoint

```
POST /api/generate-link
```

**URL Base:** `https://tu-dominio.vercel.app`

**URL Completa:** `https://tu-dominio.vercel.app/api/generate-link`

---

## Headers Requeridos

```json
{
  "Content-Type": "application/json"
}
```

---

## Estructura del Payload

### Campos de Nivel Superior

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `id_zoho` | string | Opcional | Identificador del registro en Zoho CRM. Se almacena como referencia. |
| `empresa` | object | **Sí** | Objeto con los datos de la empresa. Ver estructura detallada abajo. |
| `admins` | array | Opcional | Array de objetos con datos de administradores. Ver estructura detallada abajo. |

---

## Objeto `empresa` (OBLIGATORIO)

### Campos Obligatorios

| Campo | Tipo | Obligatorio | Formato/Validación | Ejemplo |
|-------|------|-------------|-------------------|---------|
| `razonSocial` | string | **Sí** | Texto libre | `"Construcciones del Sur SpA"` |
| `rut` | string | **Sí** | Formato: `XX.XXX.XXX-X` | `"76.543.210-5"` |
| `giro` | string | **Sí** | Texto libre | `"Construcción y obras civiles"` |
| `direccion` | string | **Sí** | Texto libre | `"Av. Libertador B. O'Higgins 1234"` |
| `comuna` | string | **Sí** | Texto libre | `"Santiago Centro"` |
| `emailFacturacion` | string | **Sí** | Email válido | `"facturacion@construcsur.cl"` |
| `telefonoContacto` | string | **Sí** | Formato: `+56XXXXXXXXX` | `"+56223456789"` |
| `rubro` | string | **Sí** | Uno de los rubros disponibles (ver lista abajo) | `"3. Construcción"` |
| `sistema` | array | **Sí** | Array con al menos 1 sistema (ver opciones abajo) | `["GeoVictoria BOX"]` |

### Campos Opcionales

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `nombreFantasia` | string | Nombre comercial de la empresa | `"Construcsur"` |

### Rubros Disponibles

Debes seleccionar **exactamente uno** de estos valores para el campo `rubro`:

```
- "1. Agrícola"
- "2. Condominio"
- "3. Construcción"
- "4. Inmobiliaria"
- "5. Consultoria"
- "6. Banca y Finanzas"
- "7. Educación"
- "8. Municipio"
- "9. Gobierno"
- "10. Mineria"
- "11. Naviera"
- "12. Outsourcing Seguridad"
- "13. Outsourcing General"
- "14. Outsourcing Retail"
- "15. Planta Productiva"
- "16. Logistica"
- "17. Retail Enterprise"
- "18. Retail SMB"
- "19. Salud"
- "20. Servicios"
- "21. Transporte"
- "22. Turismo, Hotelería y Gastronomía"
```

**Nota importante:** El valor debe incluir el número y el punto tal como se muestra arriba.

### Sistemas de Marcaje Disponibles

Debes incluir **al menos uno** de estos valores en el array `sistema`:

```
- "GeoVictoria BOX"    (Relojes Biométricos)
- "GeoVictoria CALL"   (Marcaje por Llamada)
- "GeoVictoria APP"    (Aplicación Móvil)
- "GeoVictoria USB"    (Lector USB Biométrico)
- "GeoVictoria WEB"    (Portal Web)
```

Puedes seleccionar múltiples sistemas de marcaje según las necesidades del cliente.

---

## Array `admins` (OPCIONAL pero recomendado)

Si deseas pre-llenar datos de administradores, cada objeto del array debe tener:

### Estructura de Cada Admin

| Campo | Tipo | Obligatorio | Formato/Validación | Ejemplo |
|-------|------|-------------|-------------------|---------|
| `nombre` | string | **Sí** | Texto libre (solo nombre) | `"María"` |
| `apellido` | string | **Sí** | Texto libre | `"González Pérez"` |
| `rut` | string | **Sí** | Formato: `XX.XXX.XXX-X` | `"12.345.678-9"` |
| `email` | string | **Sí** | Email válido | `"maria.gonzalez@construcsur.cl"` |
| `telefono` | string | **Sí** | Formato: `+56XXXXXXXXX` | `"+56912345678"` |
| `grupo` | string | Opcional | Departamento o área | `"Recursos Humanos"` |

---

## Ejemplo Completo de Payload

### Payload Mínimo (Solo Empresa)

```json
{
  "id_zoho": "3525045000561554077",
  "empresa": {
    "razonSocial": "Construcciones del Sur SpA",
    "rut": "76.543.210-5",
    "giro": "Construcción y obras civiles",
    "direccion": "Av. Libertador Bernardo O'Higgins 1234",
    "comuna": "Santiago Centro",
    "emailFacturacion": "facturacion@construcsur.cl",
    "telefonoContacto": "+56223456789",
    "rubro": "3. Construcción",
    "sistema": ["GeoVictoria BOX", "GeoVictoria APP"]
  }
}
```

### Payload Completo (Empresa + Administradores)

```json
{
  "id_zoho": "3525045000561554077",
  "empresa": {
    "razonSocial": "Construcciones del Sur SpA",
    "nombreFantasia": "Construcsur",
    "rut": "76.543.210-5",
    "giro": "Construcción y obras civiles",
    "direccion": "Av. Libertador Bernardo O'Higgins 1234",
    "comuna": "Santiago Centro",
    "emailFacturacion": "facturacion@construcsur.cl",
    "telefonoContacto": "+56223456789",
    "rubro": "3. Construcción",
    "sistema": ["GeoVictoria BOX", "GeoVictoria APP", "GeoVictoria WEB"]
  },
  "admins": [
    {
      "nombre": "María",
      "apellido": "González Pérez",
      "rut": "12.345.678-9",
      "email": "maria.gonzalez@construcsur.cl",
      "telefono": "+56912345678",
      "grupo": "Recursos Humanos"
    },
    {
      "nombre": "Carlos",
      "apellido": "Ramírez Silva",
      "rut": "15.678.234-5",
      "email": "carlos.ramirez@construcsur.cl",
      "telefono": "+56987654321",
      "grupo": "Operaciones"
    }
  ]
}
```

### Ejemplo con Diferentes Industrias

#### Ejemplo 1: Minería

```json
{
  "id_zoho": "3525045000561554088",
  "empresa": {
    "razonSocial": "Minera del Norte SA",
    "nombreFantasia": "MinaNorte",
    "rut": "78.123.456-7",
    "giro": "Extracción de minerales metálicos",
    "direccion": "Ruta Norte KM 45",
    "comuna": "Antofagasta",
    "emailFacturacion": "facturacion@minanorte.cl",
    "telefonoContacto": "+56552123456",
    "rubro": "10. Mineria",
    "sistema": ["GeoVictoria BOX", "GeoVictoria CALL"]
  }
}
```

#### Ejemplo 2: Retail

```json
{
  "id_zoho": "3525045000561554099",
  "empresa": {
    "razonSocial": "Supermercados El Ahorro SpA",
    "nombreFantasia": "El Ahorro",
    "rut": "79.456.789-0",
    "giro": "Comercio al por menor en supermercados",
    "direccion": "Av. Principal 5678",
    "comuna": "Viña del Mar",
    "emailFacturacion": "contabilidad@elahorro.cl",
    "telefonoContacto": "+56322567890",
    "rubro": "18. Retail SMB",
    "sistema": ["GeoVictoria BOX", "GeoVictoria USB", "GeoVictoria WEB"]
  }
}
```

#### Ejemplo 3: Educación

```json
{
  "id_zoho": "3525045000561554100",
  "empresa": {
    "razonSocial": "Colegio San Andrés",
    "nombreFantasia": "San Andrés",
    "rut": "70.234.567-8",
    "giro": "Enseñanza básica y media",
    "direccion": "Calle Los Aromos 123",
    "comuna": "Providencia",
    "emailFacturacion": "administracion@sanandres.cl",
    "telefonoContacto": "+56223334444",
    "rubro": "7. Educación",
    "sistema": ["GeoVictoria WEB", "GeoVictoria APP"]
  }
}
```

---

## Respuesta Exitosa

**Código HTTP:** `200 OK`

```json
{
  "success": true,
  "link": "https://tu-dominio.vercel.app?token=ab39e615-944f-4f87-9ffd-4f4d05810ed8",
  "token": "ab39e615-944f-4f87-9ffd-4f4d05810ed8"
}
```

### Campos de Respuesta

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `success` | boolean | Indica si la operación fue exitosa |
| `link` | string | URL completa del onboarding con el token incluido |
| `token` | string | UUID único que identifica esta sesión de onboarding |

---

## Respuestas de Error

### Error 400: Payload Vacío

```json
{
  "success": false,
  "error": "El body de la solicitud está vacío. Debes enviar un JSON con los datos de la empresa."
}
```

### Error 400: JSON Inválido

```json
{
  "success": false,
  "error": "El body de la solicitud no es un JSON válido. Verifica el formato."
}
```

### Error 400: Falta Campo Empresa

```json
{
  "success": false,
  "error": "Se requiere el campo 'empresa' o 'empresaData' con los datos de la empresa"
}
```

### Error 500: Error en Base de Datos

```json
{
  "success": false,
  "error": "Error al crear registro en base de datos: [mensaje de error]",
  "details": { ... }
}
```

---

## Ejemplos de Uso

### cURL

```bash
curl -X POST https://tu-dominio.vercel.app/api/generate-link \
  -H "Content-Type: application/json" \
  -d '{
    "id_zoho": "3525045000561554077",
    "empresa": {
      "razonSocial": "Construcciones del Sur SpA",
      "nombreFantasia": "Construcsur",
      "rut": "76.543.210-5",
      "giro": "Construcción y obras civiles",
      "direccion": "Av. Libertador Bernardo O'\''Higgins 1234",
      "comuna": "Santiago Centro",
      "emailFacturacion": "facturacion@construcsur.cl",
      "telefonoContacto": "+56223456789",
      "rubro": "3. Construcción",
      "sistema": ["GeoVictoria BOX", "GeoVictoria APP"]
    },
    "admins": [
      {
        "nombre": "María",
        "apellido": "González Pérez",
        "rut": "12.345.678-9",
        "email": "maria.gonzalez@construcsur.cl",
        "telefono": "+56912345678",
        "grupo": "Recursos Humanos"
      }
    ]
  }'
```

### JavaScript (Fetch)

```javascript
const payload = {
  id_zoho: "3525045000561554077",
  empresa: {
    razonSocial: "Construcciones del Sur SpA",
    nombreFantasia: "Construcsur",
    rut: "76.543.210-5",
    giro: "Construcción y obras civiles",
    direccion: "Av. Libertador Bernardo O'Higgins 1234",
    comuna: "Santiago Centro",
    emailFacturacion: "facturacion@construcsur.cl",
    telefonoContacto: "+56223456789",
    rubro: "3. Construcción",
    sistema: ["GeoVictoria BOX", "GeoVictoria APP", "GeoVictoria WEB"]
  },
  admins: [
    {
      nombre: "María",
      apellido: "González Pérez",
      rut: "12.345.678-9",
      email: "maria.gonzalez@construcsur.cl",
      telefono: "+56912345678",
      grupo: "Recursos Humanos"
    }
  ]
};

fetch('https://tu-dominio.vercel.app/api/generate-link', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})
  .then(response => response.json())
  .then(data => {
    console.log('Link generado:', data.link);
    console.log('Token:', data.token);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

### Python (Requests)

```python
import requests
import json

url = "https://tu-dominio.vercel.app/api/generate-link"

payload = {
    "id_zoho": "3525045000561554077",
    "empresa": {
        "razonSocial": "Construcciones del Sur SpA",
        "nombreFantasia": "Construcsur",
        "rut": "76.543.210-5",
        "giro": "Construcción y obras civiles",
        "direccion": "Av. Libertador Bernardo O'Higgins 1234",
        "comuna": "Santiago Centro",
        "emailFacturacion": "facturacion@construcsur.cl",
        "telefonoContacto": "+56223456789",
        "rubro": "3. Construcción",
        "sistema": ["GeoVictoria BOX", "GeoVictoria APP"]
    },
    "admins": [
        {
            "nombre": "María",
            "apellido": "González Pérez",
            "rut": "12.345.678-9",
            "email": "maria.gonzalez@construcsur.cl",
            "telefono": "+56912345678",
            "grupo": "Recursos Humanos"
        }
    ]
}

headers = {
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)
data = response.json()

print(f"Link generado: {data['link']}")
print(f"Token: {data['token']}")
```

---

## Función recomendada para Zoho CRM (Deluge) con validación previa

La siguiente función Deluge se puede ejecutar desde un registro del módulo `Autoservicio_Onboarding`. Valida todos los campos obligatorios definidos en este documento antes de llamar a `POST /api/generate-link`. Si falta algún dato, deja una nota en el deal y no hace la llamada, evitando tokens inválidos.

```javascript
void automation.generar_url_sesion_onboarding_v2(Int id)
{
    // =========================
    // CONFIG
    // =========================
    moduleApiName = "Autoservicio_Onboarding";
    endpoint = "https://v0-v0onboardingturnosmvp2main.vercel.app/api/generate-link";

    // Rubros permitidos (ver sección de rubros)
    rubrosPermitidos = list(
        "1. Agrícola","2. Condominio","3. Construcción","4. Inmobiliaria","5. Consultoria",
        "6. Banca y Finanzas","7. Educación","8. Municipio","9. Gobierno","10. Mineria",
        "11. Naviera","12. Outsourcing Seguridad","13. Outsourcing General","14. Outsourcing Retail",
        "15. Planta Productiva","16. Logistica","17. Retail Enterprise","18. Retail SMB",
        "19. Salud","20. Servicios","21. Transporte","22. Turismo, Hotelería y Gastronomía"
    );

    // Sistemas de marcaje permitidos
    sistemasPermitidos = list("GeoVictoria BOX","GeoVictoria CALL","GeoVictoria APP","GeoVictoria USB","GeoVictoria WEB");

    // =========================
    // 1) OBTENER REGISTRO
    // =========================
    rec = zoho.crm.getRecordById(moduleApiName,id);
    if(rec == null || rec.isEmpty())
    {
        info "❌ No se encontró el registro en " + moduleApiName + " con id: " + id;
        return;
    }

    // =========================
    // 2) VALIDAR CAMPOS OBLIGATORIOS
    // =========================
    faltantes = list();

    // Helper: agrega label si el campo viene vacío o nulo
    addIfEmpty = (fieldValue, label) =>
    {
        if(fieldValue == null || fieldValue.toString().trim() == "")
        {
            faltantes.add(label);
        }
    };

    addIfEmpty(rec.get("Raz_n_social"),"Razón Social");
    addIfEmpty(rec.get("RUT"),"RUT");
    addIfEmpty(rec.get("Giro"),"Giro");
    addIfEmpty(rec.get("Direcci_n"),"Dirección");
    addIfEmpty(rec.get("Comuna"),"Comuna");
    addIfEmpty(rec.get("Email_Facturaci_n"),"Email de facturación");
    addIfEmpty(rec.get("Tel_fono_contacto"),"Teléfono de contacto");
    addIfEmpty(rec.get("Rubro"),"Rubro");

    // Sistemas contratados (multiselect)
    sistemasCrm = rec.get("Sistemas_contratados");
    sistemasList = list();
    if(sistemasCrm != null)
    {
        for each  s in sistemasCrm
        {
            sistemasList.add(s);
        }
    }
    if(sistemasList.isEmpty())
    {
        faltantes.add("Sistema de marcaje (al menos uno)");
    }

    // Validar rubro contra lista permitida
    rubroValue = ifnull(rec.get("Rubro"),"").trim();
    if(rubroValue != "" && !rubrosPermitidos.contains(rubroValue))
    {
        faltantes.add("Rubro no válido según catálogo");
    }

    // Validar sistemas contra catálogo
    sistemasInvalidos = list();
    for each  s in sistemasList
    {
        if(!sistemasPermitidos.contains(s))
        {
            sistemasInvalidos.add(s);
        }
    }
    if(!sistemasInvalidos.isEmpty())
    {
        faltantes.add("Sistema(s) no reconocido(s): " + sistemasInvalidos.toString("; "));
    }

    if(!faltantes.isEmpty())
    {
        // Dejar nota en el registro y salir
        noteContent = "No se generó el link de onboarding. Faltan/son inválidos: " + faltantes.toString(", ");
        noteMap = map();
        noteMap.put("Note_Title","Onboarding: datos incompletos");
        noteMap.put("Note_Content",noteContent);
        noteResp = zoho.crm.addNote(moduleApiName,id,noteMap);
        info "⚠️ Datos incompletos. Se agregó nota al registro.";
        info noteResp;
        return;
    }

    // =========================
    // 3) ARMAR BODY PARA API
    // =========================
    empresaMap = map();
    empresaMap.put("razonSocial",ifnull(rec.get("Raz_n_social"),""));
    empresaMap.put("nombreFantasia",ifnull(rec.get("Nombre_de_fantas_a"),""));
    empresaMap.put("rut",ifnull(rec.get("RUT"),""));
    empresaMap.put("giro",ifnull(rec.get("Giro"),""));
    empresaMap.put("direccion",ifnull(rec.get("Direcci_n"),""));
    empresaMap.put("comuna",ifnull(rec.get("Comuna"),""));
    empresaMap.put("emailFacturacion",ifnull(rec.get("Email_Facturaci_n"),""));
    empresaMap.put("telefonoContacto",ifnull(rec.get("Tel_fono_contacto"),""));
    empresaMap.put("rubro",rubroValue);
    empresaMap.put("sistema",sistemasList);

    bodyMap = map();
    bodyMap.put("id_zoho",id.toString());
    bodyMap.put("empresa",empresaMap);

    headersMap = map();
    headersMap.put("Content-Type","application/json");

    // =========================
    // 4) INVOKEURL (POST)
    // =========================
    response = invokeurl
    [
        url :endpoint
        type :POST
        parameters:bodyMap.toString()
        headers:headersMap
    ];

    // =========================
    // 5) PARSE RESPUESTA
    // =========================
    respMap = map();
    try 
    {
        respMap = response.toMap();
    }
    catch (e)
    {
        info "❌ No pude convertir la respuesta a Map. Respuesta cruda:";
        info response;
        return;
    }

    if(respMap.get("success") != true)
    {
        info "❌ La API respondió success=false o no viene success.";
        info respMap;
        return;
    }

    link = ifnull(respMap.get("link"),"");
    token = ifnull(respMap.get("token"),"");
    if(link == "" || token == "")
    {
        info "❌ Respuesta sin link o token.";
        info respMap;
        return;
    }

    // =========================
    // 6) ACTUALIZAR REGISTRO
    // =========================
    updateMap = map();
    updateMap.put("URL_de_Onboarding",link);
    updateMap.put("Token_p_blico",token);
    updateMap.put("Token_Activo",true);

    fechaChileISO = zoho.currenttime.toString("yyyy-MM-dd'T'HH:mm:ss") + "-03:00";
    updateMap.put("Fecha_generaci_n_token",fechaChileISO);

    updateResp = zoho.crm.updateRecord(moduleApiName,id,updateMap);

    // =========================
    // 7) NOTA OPCIONAL DE ÉXITO
    // =========================
    if(updateResp.get("code") == "SUCCESS")
    {
        noteMap = map();
        noteMap.put("Note_Title","Onboarding: token generado");
        noteMap.put("Note_Content","Se generó el link de onboarding y se actualizó el registro. Link: " + link);
        zoho.crm.addNote(moduleApiName,id,noteMap);
        info "✅ URL de onboarding generada y guardada correctamente";
    }
    else
    {
        info "❌ Error al actualizar el registro:";
        info updateResp;
    }
}
```

**Qué hace y por qué es más seguro**

- Verifica presencia de todos los campos obligatorios del payload (razón social, RUT, giro, dirección, comuna, email de facturación, teléfono de contacto, rubro y al menos un sistema de marcaje).
- Valida rubro y sistemas contra los catálogos oficiales para evitar valores inválidos.
- Deja una nota en el registro cuando faltan datos o hay valores no permitidos, en lugar de disparar una API que fallaría.
- Marca fecha de generación del token y actualiza los campos de URL, token y flag de activo cuando la llamada es exitosa.

---

## Notas Importantes

1. **Formato de RUT**: Debe incluir puntos y guión. Ejemplo: `76.543.210-5`

2. **Formato de Teléfono**: Debe incluir código de país con `+`. Ejemplo: `+56912345678`

3. **Email de Facturación**: Debe ser un email válido con formato correcto

4. **Sistema de Marcaje**: Debe incluir al menos un sistema. Se permiten múltiples selecciones.

5. **Rubro**: Debe ser exactamente uno de los valores listados en la sección "Rubros Disponibles"

6. **ID de Zoho**: Es opcional pero altamente recomendado para mantener la trazabilidad con tu CRM

7. **Persistencia**: Los datos se guardan en Supabase y pueden ser actualizados a medida que el usuario avanza en el onboarding

8. **Token**: El token generado es un UUID v4 único que sirve como identificador del registro en la base de datos

---

## Validaciones del Sistema

Una vez que el usuario accede al link, el sistema validará:

### Paso Empresa
- Razón Social: Obligatorio
- RUT: Obligatorio, formato válido
- Giro: Obligatorio
- Dirección: Obligatorio
- Comuna: Obligatorio
- Email de Facturación: Obligatorio, formato válido
- Teléfono de Contacto: Obligatorio, formato válido
- Rubro: Obligatorio, debe ser uno de los valores predefinidos
- Sistema de Marcaje: Obligatorio, al menos uno seleccionado

### Paso Administradores
- Nombre: Obligatorio
- Apellido: Obligatorio
- RUT: Obligatorio, formato `XX.XXX.XXX-X`
- Email: Obligatorio, formato válido
- Teléfono: Obligatorio, formato `+56XXXXXXXXX` o similar
- Grupo: Opcional

---

## Integración con Zoho Flow

Cuando el usuario completa el onboarding, los datos se envían automáticamente a Zoho Flow mediante el webhook configurado en `ZOHO_FLOW_TEST_URL`. El payload incluye:

- `id_zoho`: ID original enviado en la generación del link
- `formData`: Todos los datos completados durante el onboarding
- `excelFile`: Archivo Excel en Base64 con todos los datos estructurados
- `metadata`: Información del progreso y estado final

---

## Soporte

Para cualquier consulta o problema con la API, contacta al equipo de desarrollo o revisa los logs del servidor para obtener información detallada sobre errores.
