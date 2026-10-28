import { LoginForm } from "@/app/login/login-form"

export const metadata = { title: "Sign in · Design Team KPI Dashboard" }

/** Reasons app/auth/hub/route.ts sends back in `?error=`. */
const HUB_ERRORS: Record<string, string> = {
  cancelled: "Google sign-in was cancelled.",
  expired: "The sign-in took too long or was started in another tab. Try again.",
  "not-configured": "Google sign-in is not configured on the server.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams
  const hubError = error ? (HUB_ERRORS[error] ?? "Google sign-in failed. Try again.") : undefined

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <img src="/modula_jsw.svg" alt="Modula JSW" className="h-9 w-auto" />
      <LoginForm next={next ?? "/"} hubError={hubError} />
      <p className="text-muted-foreground text-xs">Design Team KPI Dashboard</p>
    </div>
  )
}
