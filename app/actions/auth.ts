"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { SESSION, signSession } from "@/lib/auth"

/**
 * ponytail: attempt throttle is a module-level map — good enough for the single
 * instance this runs on. Move it to Redis if the app is ever scaled out.
 */
const attempts = new Map<string, { count: number; until: number }>()
const MAX_ATTEMPTS = 8
const LOCKOUT_MS = 5 * 60 * 1000

export interface LoginState {
  error?: string
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  if (!email || !password) return { error: "Email and password are required." }

  const now = Date.now()
  const record = attempts.get(email)
  if (record && record.count >= MAX_ATTEMPTS && record.until > now) {
    return { error: "Too many attempts. Try again in a few minutes." }
  }

  const expectedEmail = (process.env.AUTH_EMAIL ?? "").trim().toLowerCase()
  const expectedPassword = process.env.AUTH_PASSWORD ?? ""
  if (!expectedEmail || !expectedPassword) return { error: "Login is not configured on the server." }

  if (email !== expectedEmail || password !== expectedPassword) {
    const next = record && record.until > now ? record.count + 1 : 1
    attempts.set(email, { count: next, until: now + LOCKOUT_MS })
    return { error: "Invalid email or password." }
  }

  attempts.delete(email)
  const store = await cookies()
  store.set(SESSION.cookie, await signSession(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION.maxAge,
  })

  const next = String(formData.get("next") ?? "/")
  redirect(next.startsWith("/") ? next : "/")
}

export async function logout() {
  const store = await cookies()
  store.delete(SESSION.cookie)
  redirect("/login")
}
