import { inngest } from "@/inngest/client"
import { sql } from "@/lib/db"
import { generateDailyDigest } from "@/lib/gemini"
import { sendDailyDigest, type DailyDigestData } from "@/lib/email"

export const dailyEmailDigest = inngest.createFunction(
  {
    id: "daily-email-digest",
    retries: 1,
    triggers: [{ cron: "0 21 * * *" }], // 9pm UTC daily
  },
  async ({ step }) => {
    const users = await step.run("get-users", async () => {
      return await sql`
        SELECT id, email FROM users
        WHERE email IS NOT NULL AND email != ''
      ` as { id: string; email: string }[]
    })

    for (const user of users) {
      await step.run(`email-${user.id}`, async () => {
        const [commits, prRow, reviewRow, spotifyRow, spotifyTracks, steamRow, steamGames] =
          await Promise.all([
            sql`
              SELECT repo, message, additions, deletions FROM github_commits
              WHERE user_id = ${user.id} AND date >= NOW() - INTERVAL '1 day'
              ORDER BY date DESC
            `,
            sql`
              SELECT COUNT(*)::int as count FROM github_prs
              WHERE user_id = ${user.id} AND opened_at >= NOW() - INTERVAL '1 day'
            `,
            sql`
              SELECT COUNT(*)::int as count FROM github_reviews
              WHERE user_id = ${user.id} AND submitted_at >= NOW() - INTERVAL '1 day'
            `,
            sql`SELECT user_id FROM spotify_tokens WHERE user_id = ${user.id}`,
            sql`
              SELECT track_name, artist_names FROM spotify_plays
              WHERE user_id = ${user.id} AND played_at >= NOW() - INTERVAL '1 day'
              ORDER BY played_at DESC
            `,
            sql`SELECT user_id FROM steam_config WHERE user_id = ${user.id}`,
            sql`
              SELECT name, playtime_2weeks FROM steam_recently_played
              WHERE user_id = ${user.id}
              ORDER BY playtime_2weeks DESC LIMIT 5
            `,
          ])

        const commitRows = commits as { repo: string; message: string; additions: number; deletions: number }[]
        const spotifyConnected = spotifyRow.length > 0
        const steamConnected = steamRow.length > 0
        const trackRows = spotifyTracks as { track_name: string; artist_names: string }[]

        // Skip users with no activity today
        if (commitRows.length === 0 && trackRows.length === 0) return

        const narrative = await generateDailyDigest({
          username: user.id,
          date: new Date().toISOString().split("T")[0],
          github: {
            commits: commitRows.length,
            repos: [...new Set(commitRows.map(c => c.repo))],
            prs: (prRow[0] as { count: number }).count,
            reviews: (reviewRow[0] as { count: number }).count,
          },
          spotify: {
            connected: spotifyConnected,
            tracks: trackRows.slice(0, 5).map(t => ({ track: t.track_name, artist: t.artist_names })),
          },
          steam: {
            connected: steamConnected,
            recentGames: (steamGames as { name: string; playtime_2weeks: number }[]).map(g => ({
              name: g.name,
              hoursThisWeek: g.playtime_2weeks / 60,
            })),
          },
        })

        const digestData: DailyDigestData = {
          username: user.id,
          email: user.email,
          date: new Date().toISOString().split("T")[0],
          narrative,
          github: {
            commits: commitRows,
            prsOpened: (prRow[0] as { count: number }).count,
            reviewsSubmitted: (reviewRow[0] as { count: number }).count,
          },
          spotify: {
            connected: spotifyConnected,
            tracks: trackRows,
          },
          steam: {
            connected: steamConnected,
            recentGames: steamGames as { name: string; playtime_2weeks: number }[],
          },
        }

        await sendDailyDigest(digestData)
      })
    }

    return { status: "daily-emails-sent", userCount: users.length }
  }
)
