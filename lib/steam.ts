import { sql } from "@/lib/db"

const STEAM_API = "https://api.steampowered.com"

// ─── Config ──────────────────────────────────────────────────────────────────

export async function getSteamConfig(userId: string) {
  const rows = await sql`
    SELECT api_key, steam_id FROM steam_config WHERE user_id = ${userId}
  ` as { api_key: string; steam_id: string }[]
  return rows[0] ?? null
}

export async function getAllUsersWithSteam() {
  const rows = await sql`SELECT user_id FROM steam_config`
  return rows as unknown as { user_id: string }[]
}

// ─── Fetchers ────────────────────────────────────────────────────────────────

export async function fetchRecentlyPlayed(apiKey: string, steamId: string) {
  const res = await fetch(
    `${STEAM_API}/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json`
  )
  if (!res.ok) throw new Error(`Steam recently played failed: ${res.status}`)
  const data = (await res.json()) as {
    response: {
      games?: {
        appid: number
        name: string
        playtime_2weeks: number
        playtime_forever: number
      }[]
    }
  }
  return data.response.games ?? []
}

export async function fetchOwnedGames(apiKey: string, steamId: string) {
  const res = await fetch(
    `${STEAM_API}/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&include_appinfo=true&format=json`
  )
  if (!res.ok) throw new Error(`Steam owned games failed: ${res.status}`)
  const data = (await res.json()) as {
    response: {
      games?: {
        appid: number
        name: string
        playtime_forever: number
      }[]
    }
  }
  return data.response.games ?? []
}

// ─── Database writes ─────────────────────────────────────────────────────────

export async function saveRecentlyPlayed(
  userId: string,
  games: Awaited<ReturnType<typeof fetchRecentlyPlayed>>
) {
  for (const game of games) {
    await sql`
      INSERT INTO steam_recently_played (id, user_id, app_id, name, playtime_2weeks, playtime_forever)
      VALUES (
        ${`${userId}:${game.appid}`},
        ${userId},
        ${game.appid},
        ${game.name},
        ${game.playtime_2weeks},
        ${game.playtime_forever}
      )
      ON CONFLICT (user_id, app_id) DO UPDATE SET
        playtime_2weeks = EXCLUDED.playtime_2weeks,
        playtime_forever = EXCLUDED.playtime_forever,
        synced_at = NOW()
    `
  }
}

export async function saveOwnedGames(
  userId: string,
  games: Awaited<ReturnType<typeof fetchOwnedGames>>,
  snapshotDate: string
) {
  for (const game of games) {
    if (game.playtime_forever === 0) continue
    await sql`
      INSERT INTO steam_games (id, user_id, app_id, name, playtime_forever, snapshot_date)
      VALUES (
        ${`${userId}:${game.appid}:${snapshotDate}`},
        ${userId},
        ${game.appid},
        ${game.name},
        ${game.playtime_forever},
        ${snapshotDate}
      )
      ON CONFLICT (user_id, app_id, snapshot_date) DO UPDATE SET
        playtime_forever = EXCLUDED.playtime_forever
    `
  }
}
