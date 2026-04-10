import { auth } from "@/auth"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function DELETE() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session as { login: string }).login
  await sql`DELETE FROM spotify_tokens WHERE user_id = ${userId}`

  return NextResponse.json({ ok: true })
}
