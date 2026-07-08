import type { Metadata } from "next"
import DemoOnboarding from "@/components/demo-onboarding"

// Página DEMO del auto-onboarding (ver components/demo-onboarding.tsx): la UI
// real con la red desconectada, para mostrar la experiencia sin guardar nada.
export const metadata: Metadata = {
  title: "Demo — Auto-onboarding GeoVictoria",
  robots: { index: false, follow: false },
}

export default function DemoPage() {
  return <DemoOnboarding />
}
