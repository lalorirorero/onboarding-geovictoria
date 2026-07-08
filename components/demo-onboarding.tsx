"use client"

/**
 * Modo DEMO del auto-onboarding (para mostrar la experiencia a Producto).
 *
 * Renderiza el MISMO componente real (onboarding-turnos) pero con la capa de
 * red desconectada: se intercepta window.fetch ANTES de montar el componente y
 * toda llamada a /api/* se responde localmente con éxitos falsos. Nada de lo
 * que se ingrese sale del navegador — no se guarda en BD, no llega a Zoho, no
 * consulta al LLM. Al recargar la página, la demo parte de cero.
 */

import { Suspense, useState } from "react"
import OnboardingTurnos from "@/components/onboarding-turnos"

function instalarModoDemo(): void {
  if (typeof window === "undefined") return
  const w = window as typeof window & { __vickyDemoFetch?: boolean }
  if (w.__vickyDemoFetch) return
  w.__vickyDemoFetch = true

  // El componente exige un token en la URL; en demo lo inyectamos nosotros.
  const params = new URLSearchParams(window.location.search)
  if (!params.get("token")) {
    params.set("token", "demo-producto")
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`)
  }

  const realFetch = window.fetch.bind(window)
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url

    // Solo interceptamos la API de la app; los assets/chunks de Next pasan normal.
    if (url.includes("/api/")) {
      if (url.includes("/api/agent-scheduling")) {
        return json({
          success: true,
          actions: [],
          assistantMessage:
            "(Demo) En la versión real, aquí el agente entiende tu instrucción y crea o modifica los turnos por ti. En esta demo el modelo está desconectado.",
        })
      }
      if (url.includes("/api/onboarding/")) {
        const method = (init?.method || "GET").toUpperCase()
        if (method === "GET") {
          // Carga inicial: onboarding "en blanco" — la demo parte del paso 0.
          return json({ success: true, formData: null, lastStep: 0, navigationHistory: [0] })
        }
        // Guardados de avance: éxito falso, no persiste nada.
        return json({ success: true })
      }
      // Cualquier otra API de la app (submit-to-zoho, compliance, etc.): éxito falso.
      return json({ success: true })
    }
    return realFetch(input, init)
  }
}

export default function DemoOnboarding() {
  // El parche se instala en el inicializador de estado: corre ANTES del primer
  // render de los hijos, así ningún fetch del onboarding escapa al mock.
  useState(() => {
    instalarModoDemo()
    return true
  })

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="sticky top-0 z-50 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow">
        🧪 DEMO interactiva del auto-onboarding — sin conexión: nada de lo que ingreses se envía ni
        se guarda. Al recargar, parte de cero.
      </div>
      <div className="p-6">
        <div className="mx-auto max-w-6xl">
          <Suspense
            fallback={
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
              </div>
            }
          >
            <OnboardingTurnos />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
