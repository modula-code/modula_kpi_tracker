import { LoginForm } from "@/app/login/login-form"

export const metadata = { title: "Sign in · Design Team KPI Dashboard" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <img src="/modula_jsw.svg" alt="Modula JSW" className="h-9 w-auto" />
      <LoginForm next={next ?? "/"} />
      <p className="text-muted-foreground text-xs">Design Team KPI Dashboard</p>
    </div>
  )
}
