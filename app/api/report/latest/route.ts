import { auth } from "@/auth"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const userId = (session as { login: string }).login

  const rows = await sql`
    SELECT content, report_date, created_at FROM weekly_reports
    WHERE user_id = ${userId}
    ORDER BY report_date DESC LIMIT 1
  ` as { content: string; report_date: string; created_at: string }[]

  return Response.json(rows[0] ?? null)
}
