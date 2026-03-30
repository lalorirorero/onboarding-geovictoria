# GeoVictoria Auto-Onboarding

Repositorio oficial de la app de auto-onboarding administrada por GeoVictoria.

## Alcance

- Producto: onboarding para clientes GeoVictoria.
- Integraciones principales: Zoho CRM, Zoho Flow y Supabase.
- Frontend y backend: Next.js (App Router).

## Separacion de apps

Este repositorio es solo para GeoVictoria.

- Repo Geo: `https://github.com/lalorirorero/onboarding-geovictoria`
- Repo Nubox (separado): `https://github.com/lalorirorero/onboarding-nubox`

Regla operativa: no mezclar cambios entre repositorios.

## Flujo funcional resumido

1. Zoho CRM solicita generar link de onboarding (`/api/generate-link`).
2. El cliente completa pasos del onboarding en la app.
3. La app envia progreso/finalizacion a Zoho Flow.
4. Se persisten datos y trazas de cumplimiento en Supabase.

## Requisitos locales

- Node.js 20+
- pnpm 9+
- Variables de entorno configuradas en `.env.local`

Variables minimas:

- `NEXT_PUBLIC_BASE_URL`
- `ZOHO_FLOW_TEST_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CRON_SECRET` (o `COMPLIANCE_API_SECRET`)

## Ejecucion local

```bash
pnpm install
pnpm dev
```

App local: `http://localhost:3000`

## Validaciones recomendadas antes de push

```bash
pnpm build
git status -sb
```

## Despliegue

- Plataforma: Vercel
- Proyecto Geo: `v0-v0onboardingturnosmvp2main`
- Dominio productivo: `https://onboarding.geovictoria.com`

## Controles de cumplimiento implementados

- Registro auditable de consentimientos.
- Endpoint para solicitudes de titulares (acceso/rectificacion/supresion/etc.).
- Retencion automatizada y purga de datos.
- RLS habilitado en tablas sensibles.
- Funciones SQL con `search_path` fijo.
- Endpoints de cumplimiento protegidos por secreto (`CRON_SECRET`/`COMPLIANCE_API_SECRET`).

## Documentacion util

- `PROTECCION_DATOS.md`
- `docs/compliance-rollout-supabase.md`
- `docs/compliance-security-dossier.md`
- `ZOHO_INTEGRATION.md`
- `ZOHO_CRM_SETUP.md`

## Convenciones de ramas

- Rama estable: `main`
- Cambios: rama feature -> PR -> merge a `main`
- Nunca commitear secretos ni `.env.local`
