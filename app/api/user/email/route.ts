import { auth } from "@/auth"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function PATCH(req: Request) {
  const origin = req.headers.get("origin")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  if (!origin || new URL(origin).origin !== new URL(appUrl).origin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { email } = await req.json()
  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 })
  }

  const userId = (session as { login: string }).login
  await sql`UPDATE users SET email = ${email} WHERE id = ${userId}`

  return NextResponse.json({ ok: true })
}
