import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] generate-link: Recibiendo solicitud")

    let body
    try {
      const text = await request.text()
      console.log("[v0] generate-link: Body recibido (texto):", text)

      if (!text || text.trim() === "") {
        return NextResponse.json(
          {
            success: false,
            error: "El body de la solicitud está vacío. Debes enviar un JSON con los datos de la empresa.",
          },
          { status: 400 },
        )
      }

      body = JSON.parse(text)
      console.log("[v0] generate-link: Body parseado exitosamente")
    } catch (parseError) {
      console.error("[v0] generate-link: Error parseando JSON:", parseError)
      return NextResponse.json(
        {
          success: false,
          error: "El body de la solicitud no es un JSON válido. Verifica el formato.",
        },
        { status: 400 },
      )
    }

    if (!body.empresa && !body.empresaData) {
      return NextResponse.json(
        {
          success: false,
          error: "Se requiere el campo 'empresa' o 'empresaData' con los datos de la empresa",
        },
        { status: 400 },
      )
    }

    const id_zoho = body.id_zoho ? String(body.id_zoho) : null

    // Estructura de datos inicial consistente
    const formData = {
      empresa: {
        razonSocial: body.empresa?.razonSocial || body.empresaData?.razonSocial || "",
        nombreFantasia: body.empresa?.nombreFantasia || body.empresaData?.nombreFantasia || "",
        rut: body.empresa?.rut || body.empresaData?.rut || "",
        giro: body.empresa?.giro || body.empresaData?.giro || "",
        direccion: body.empresa?.direccion || body.empresaData?.direccion || "",
        comuna: body.empresa?.comuna || body.empresaData?.comuna || "",
        emailFacturacion: body.empresa?.emailFacturacion || body.empresaData?.emailFacturacion || "",
        telefonoContacto: body.empresa?.telefonoContacto || body.empresaData?.telefonoContacto || "",
        ejecutivoTelefono: body.empresa?.ejecutivoTelefono || body.empresaData?.ejecutivoTelefono || "",
        ejecutivoNombre: body.empresa?.ejecutivoNombre || body.empresaData?.ejecutivoNombre || "",
        sistema: body.empresa?.sistema || body.empresaData?.sistema || [],
        modulosAdicionales: body.empresa?.modulosAdicionales || body.empresaData?.modulosAdicionales || [],
        modulosAdicionalesOtro:
          body.empresa?.modulosAdicionalesOtro || body.empresaData?.modulosAdicionalesOtro || "",
        rubro: body.empresa?.rubro || body.empresaData?.rubro || "",
        grupos: [],
        id_zoho: id_zoho,
      },
      admins: body.admins || body.empresaData?.admins || [],
      trabajadores: body.trabajadores || body.empresaData?.trabajadores || [],
      turnos: body.turnos || body.empresaData?.turnos || [],
      planificaciones: body.planificaciones || body.empresaData?.planificaciones || [],
      asignaciones: body.asignaciones || body.empresaData?.asignaciones || [],
      configureNow: false,
      loadWorkersNow: false,
    }

    console.log("[v0] generate-link: Creando registro en BD:", {
      id_zoho,
      razonSocial: formData.empresa.razonSocial,
      rut: formData.empresa.rut,
    })

    // Crear registro en Supabase
    const supabase = await getSupabaseServerClient()

    const { data, error } = await supabase
      .from("onboardings")
      .insert({
        id_zoho: id_zoho || "sin-id",
        estado: "pendiente",
        datos_actuales: formData,
        ultimo_paso: 0,
        navigation_history: [0],
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] generate-link: Error creando registro en Supabase:", error)
      return NextResponse.json(
        {
          success: false,
          error: `Error al crear registro en base de datos: ${error.message}`,
          details: error,
        },
        { status: 500 },
      )
    }

    // Token es simplemente el UUID del registro
    const token = data.id
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const link = `${baseUrl}?token=${token}`

    console.log("[v0] generate-link: Registro creado exitosamente:", {
      id: data.id,
      link,
    })

    return NextResponse.json({
      success: true,
      link,
      token,
    })
  } catch (error) {
    console.error("[v0] generate-link: Error general:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
