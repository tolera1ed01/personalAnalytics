import { sql } from "@/lib/db"
import { inngest } from "@/inngest/client"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const code = req.nextUrl.searchParams.get("code")
  const stateParam = req.nextUrl.searchParams.get("state")

  const cookieStore = await cookies()
  const storedState = cookieStore.get("spotify_oauth_state")?.value
  cookieStore.delete("spotify_oauth_state")

  if (!code || !stateParam || !storedState || stateParam !== storedState) {
    return NextResponse.redirect(`${appUrl}/dashboard?spotify=error`)
  }

  const userId = storedState.split(":")[0]
  if (!userId) {
    return NextResponse.redirect(`${appUrl}/dashboard?spotify=error`)
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
    return NextResponse.redirect(`${appUrl}/dashboard?spotify=error`)
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

  return NextResponse.redirect(`${appUrl}/dashboard?spotify=connected`)
}
