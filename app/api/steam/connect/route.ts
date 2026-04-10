import { auth } from "@/auth"
import { sql } from "@/lib/db"
import { inngest } from "@/inngest/client"
import type { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const { apiKey, steamId } = (await req.json()) as { apiKey: string; steamId: string }
  if (!apiKey?.trim() || !steamId?.trim()) {
    return new Response("Missing fields", { status: 400 })
  }

  // Validate by hitting the Steam API
  const res = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`
  )
  const data = (await res.json()) as { response: { players: { steamid: string }[] } }
  if (!data.response?.players?.length) {
    return new Response("Invalid API key or Steam ID", { status: 400 })
  }

  const userId = (session as { login: string }).login

  await sql`
    INSERT INTO steam_config (user_id, api_key, steam_id)
    VALUES (${userId}, ${apiKey.trim()}, ${steamId.trim()})
    ON CONFLICT (user_id) DO UPDATE SET
      api_key = EXCLUDED.api_key,
      steam_id = EXCLUDED.steam_id
  `

  await inngest.send({
    name: "steam/backfill.requested",
    data: { userId },
  })

  return new Response("OK")
}
