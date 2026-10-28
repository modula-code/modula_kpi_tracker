import { logout } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { safeNext } from "@/lib/sso"

export const metadata = { title: "Sign-in unavailable · Design Team KPI Dashboard" }

/**
 * Where proxy.ts sends a Google sign-in it could not re-check because Keycloak did not answer
 * (spec §1: 503, access is never extended). Public, so it can never loop.
 */
export default async function UnavailablePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- the same static SVG logo as /login */}
      <img src="/modula_jsw.svg" alt="Modula JSW" className="h-9 w-auto" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Sign-in service unavailable</CardTitle>
          <CardDescription>
            The dashboard could not confirm your Google sign-in, so access is paused. Your account is fine. Try
            again in a minute.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild>
            <a href={safeNext(next)}>Try again</a>
          </Button>
          <form action={logout}>
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs">Design Team KPI Dashboard</p>
    </div>
  )
}
