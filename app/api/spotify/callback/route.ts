import { sql } from "@/lib/db"
import { inngest } from "@/inngest/client"
import type { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const userId = req.nextUrl.searchParams.get("state")

  if (!code || !userId) {
    return Response.redirect("http://localhost:3000/dashboard?spotify=error")
  }

  // Exchange code for tokens
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    }),
  })

  if (!res.ok) {
    return Response.redirect("http://localhost:3000/dashboard?spotify=error")
  }

  const tokens = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

  await sql`
    INSERT INTO spotify_tokens (user_id, access_token, refresh_token, expires_at)
    VALUES (${userId}, ${tokens.access_token}, ${tokens.refresh_token}, ${expiresAt.toISOString()})
    ON CONFLICT (user_id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
  `

  await inngest.send({
    name: "spotify/backfill.requested",
    data: { userId },
  })

  return Response.redirect("http://localhost:3000/dashboard?spotify=connected")
}
