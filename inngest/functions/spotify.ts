import { inngest } from "@/inngest/client"
import {
  getValidToken,
  fetchRecentlyPlayed,
  fetchTopTracks,
  fetchTopArtists,
  savePlays,
  saveTopTracks,
  saveTopArtists,
  getAllUsersWithSpotifyTokens,
} from "@/lib/spotify"

const TIME_RANGES = ["short_term", "medium_term", "long_term"] as const

// ─── Backfill — triggered when user first connects Spotify ───────────────────

export const spotifyBackfill = inngest.createFunction(
  {
    id: "spotify-backfill",
    retries: 2,
    triggers: [{ event: "spotify/backfill.requested" }],
  },
  async ({ event, step }) => {
    const { userId } = event.data as { userId: string }

    const token = await step.run("get-token", () => getValidToken(userId))

    await step.run("sync-recently-played", async () => {
      const items = await fetchRecentlyPlayed(token)
      await savePlays(userId, items)
    })

    for (const range of TIME_RANGES) {
      await step.run(`sync-top-tracks-${range}`, async () => {
        const snapshotDate = new Date().toISOString().split("T")[0]
        const tracks = await fetchTopTracks(token, range)
        await saveTopTracks(userId, tracks, range, snapshotDate)
      })

      await step.run(`sync-top-artists-${range}`, async () => {
        const snapshotDate = new Date().toISOString().split("T")[0]
        const artists = await fetchTopArtists(token, range)
        await saveTopArtists(userId, artists, range, snapshotDate)
      })
    }

    return { userId, status: "spotify-backfill-complete" }
  }
)

// ─── Weekly sync — runs alongside GitHub weekly sync ─────────────────────────

export const spotifyWeeklySync = inngest.createFunction(
  {
    id: "spotify-weekly-sync",
    retries: 2,
    triggers: [{ cron: "0 1 * * 0" }],
  },
  async ({ step }) => {
    const users = await step.run("get-all-spotify-users", () =>
      getAllUsersWithSpotifyTokens()
    )

    for (const user of users) {
      await step.run(`sync-spotify-user-${user.user_id}`, async () => {
        const token = await getValidToken(user.user_id)
        const snapshotDate = new Date().toISOString().split("T")[0]

        const plays = await fetchRecentlyPlayed(token)
        await savePlays(user.user_id, plays)

        for (const range of TIME_RANGES) {
          const tracks = await fetchTopTracks(token, range)
          await saveTopTracks(user.user_id, tracks, range, snapshotDate)

          const artists = await fetchTopArtists(token, range)
          await saveTopArtists(user.user_id, artists, range, snapshotDate)
        }
      })
    }

    return { status: "spotify-weekly-sync-complete", userCount: users.length }
  }
)
