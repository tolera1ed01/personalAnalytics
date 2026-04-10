import { sql } from "@/lib/db"

const SPOTIFY_API = "https://api.spotify.com/v1"

// ─── Token management ────────────────────────────────────────────────────────

export async function getValidToken(userId: string): Promise<string> {
  const rows = await sql`
    SELECT access_token, refresh_token, expires_at
    FROM spotify_tokens
    WHERE user_id = ${userId}
  ` as { access_token: string; refresh_token: string; expires_at: string }[]

  if (!rows.length) throw new Error(`No Spotify token for user ${userId}`)

  const { access_token, refresh_token, expires_at } = rows[0]

  // If token expires in less than 5 minutes, refresh it
  if (new Date(expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
    return refreshToken(userId, refresh_token)
  }

  return access_token
}

async function refreshToken(userId: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) throw new Error(`Failed to refresh Spotify token: ${res.status}`)

  const data = (await res.json()) as {
    access_token: string
    expires_in: number
    refresh_token?: string
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000)

  await sql`
    UPDATE spotify_tokens SET
      access_token = ${data.access_token},
      refresh_token = ${data.refresh_token ?? refreshToken},
      expires_at = ${expiresAt.toISOString()},
      updated_at = NOW()
    WHERE user_id = ${userId}
  `

  return data.access_token
}

// ─── API fetchers ────────────────────────────────────────────────────────────

export async function fetchRecentlyPlayed(token: string) {
  const res = await fetch(
    `${SPOTIFY_API}/me/player/recently-played?limit=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Failed to fetch recently played: ${res.status}`)

  const data = (await res.json()) as {
    items: {
      track: {
        id: string
        name: string
        duration_ms: number
        album: { name: string }
        artists: { name: string }[]
      }
      played_at: string
    }[]
  }

  return data.items
}

export async function fetchTopTracks(token: string, timeRange: "short_term" | "medium_term" | "long_term") {
  const res = await fetch(
    `${SPOTIFY_API}/me/top/tracks?limit=50&time_range=${timeRange}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Failed to fetch top tracks (${timeRange}): ${res.status}`)

  const data = (await res.json()) as {
    items: {
      id: string
      name: string
      artists: { name: string }[]
    }[]
  }

  return data.items
}

export async function fetchTopArtists(token: string, timeRange: "short_term" | "medium_term" | "long_term") {
  const res = await fetch(
    `${SPOTIFY_API}/me/top/artists?limit=50&time_range=${timeRange}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Failed to fetch top artists (${timeRange}): ${res.status}`)

  const data = (await res.json()) as {
    items: {
      id: string
      name: string
      genres: string[]
    }[]
  }

  return data.items
}

// ─── Database writes ─────────────────────────────────────────────────────────

export async function savePlays(
  userId: string,
  items: Awaited<ReturnType<typeof fetchRecentlyPlayed>>
) {
  for (const item of items) {
    const artistNames = item.track.artists.map((a) => a.name).join(", ")
    await sql`
      INSERT INTO spotify_plays (id, user_id, track_id, track_name, artist_names, album_name, played_at, duration_ms)
      VALUES (
        ${`${userId}:${item.played_at}`},
        ${userId},
        ${item.track.id},
        ${item.track.name},
        ${artistNames},
        ${item.track.album.name},
        ${item.played_at},
        ${item.track.duration_ms}
      )
      ON CONFLICT (user_id, played_at) DO NOTHING
    `
  }
}

export async function saveTopTracks(
  userId: string,
  tracks: Awaited<ReturnType<typeof fetchTopTracks>>,
  timeRange: string,
  snapshotDate: string
) {
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]
    const artistNames = track.artists.map((a) => a.name).join(", ")
    await sql`
      INSERT INTO spotify_top_tracks (id, user_id, track_id, track_name, artist_names, time_range, rank, snapshot_date)
      VALUES (
        ${`${userId}:${timeRange}:${snapshotDate}:${i + 1}`},
        ${userId},
        ${track.id},
        ${track.name},
        ${artistNames},
        ${timeRange},
        ${i + 1},
        ${snapshotDate}
      )
      ON CONFLICT (user_id, time_range, snapshot_date, rank) DO UPDATE SET
        track_id = EXCLUDED.track_id,
        track_name = EXCLUDED.track_name,
        artist_names = EXCLUDED.artist_names
    `
  }
}

export async function saveTopArtists(
  userId: string,
  artists: Awaited<ReturnType<typeof fetchTopArtists>>,
  timeRange: string,
  snapshotDate: string
) {
  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i]
    await sql`
      INSERT INTO spotify_top_artists (id, user_id, artist_id, artist_name, genres, time_range, rank, snapshot_date)
      VALUES (
        ${`${userId}:${timeRange}:${snapshotDate}:${i + 1}`},
        ${userId},
        ${artist.id},
        ${artist.name},
        ${(artist.genres ?? []).join(", ")},
        ${timeRange},
        ${i + 1},
        ${snapshotDate}
      )
      ON CONFLICT (user_id, time_range, snapshot_date, rank) DO UPDATE SET
        artist_id = EXCLUDED.artist_id,
        artist_name = EXCLUDED.artist_name,
        genres = EXCLUDED.genres
    `
  }
}

export async function getAllUsersWithSpotifyTokens() {
  const rows = await sql`SELECT user_id FROM spotify_tokens`
  return rows as unknown as { user_id: string }[]
}
