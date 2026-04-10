import { auth } from "@/auth"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { email } = await req.json()
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 })
  }

  const userId = (session as { login: string }).login
  await sql`UPDATE users SET email = ${email} WHERE id = ${userId}`

  return NextResponse.json({ ok: true })
}
