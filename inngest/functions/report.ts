import { inngest } from "@/inngest/client"
import { sql } from "@/lib/db"
import { generateWeeklyReport } from "@/lib/gemini"
import { NonRetriableError } from "inngest"

async function buildAndSaveReport(userId: string) {
  const weekOf = new Date().toISOString().split("T")[0]

  // GitHub data for the past 7 days
  const [commitRows, prRow, reviewRow, repoRows, spotifyRow, recentTracks, topArtists, steamRow, steamRecent] =
    await Promise.all([
      sql`SELECT COUNT(*)::int as count FROM github_commits WHERE user_id = ${userId} AND date >= NOW() - INTERVAL '7 days'`,
      sql`SELECT COUNT(*)::int as count FROM github_prs WHERE user_id = ${userId}`,
      sql`SELECT COUNT(*)::int as count FROM github_reviews WHERE user_id = ${userId}`,
      sql`SELECT DISTINCT repo FROM github_commits WHERE user_id = ${userId} AND date >= NOW() - INTERVAL '7 days' LIMIT 10`,
      sql`SELECT user_id FROM spotify_tokens WHERE user_id = ${userId}`,
      sql`SELECT track_name, artist_names FROM spotify_plays WHERE user_id = ${userId} ORDER BY played_at DESC LIMIT 5`,
      sql`
        SELECT artist_name FROM spotify_top_artists
        WHERE user_id = ${userId} AND time_range = 'short_term'
          AND snapshot_date = (SELECT MAX(snapshot_date) FROM spotify_top_artists WHERE user_id = ${userId})
        ORDER BY rank LIMIT 3
      `,
      sql`SELECT user_id FROM steam_config WHERE user_id = ${userId}`,
      sql`SELECT name, playtime_2weeks FROM steam_recently_played WHERE user_id = ${userId} ORDER BY playtime_2weeks DESC LIMIT 5`,
    ])

  const content = await generateWeeklyReport({
    username: userId,
    weekOf,
    github: {
      commits: (commitRows[0] as { count: number }).count,
      repos: (repoRows as { repo: string }[]).map((r) => r.repo),
      prs: (prRow[0] as { count: number }).count,
      reviews: (reviewRow[0] as { count: number }).count,
    },
    spotify: {
      connected: spotifyRow.length > 0,
      recentTracks: (recentTracks as { track_name: string; artist_names: string }[]).map((t) => ({
        track: t.track_name,
        artist: t.artist_names,
      })),
      topArtists: (topArtists as { artist_name: string }[]).map((a) => a.artist_name),
    },
    steam: {
      connected: steamRow.length > 0,
      recentGames: (steamRecent as { name: string; playtime_2weeks: number }[]).map((g) => ({
        name: g.name,
        hoursThisWeek: g.playtime_2weeks / 60,
      })),
    },
  })

  // Check if we have a recent report (within 5 days) — if so, update it instead of creating a new one
  const lastRows = await sql`
    SELECT report_date FROM weekly_reports
    WHERE user_id = ${userId}
    ORDER BY report_date DESC LIMIT 1
  ` as { report_date: string }[]

  const last = lastRows[0]
  const daysSinceLast = last
    ? Math.floor((new Date(weekOf).getTime() - new Date(last.report_date).getTime()) / 86_400_000)
    : Infinity

  if (last && daysSinceLast < 5) {
    // Update the existing report
    await sql`
      UPDATE weekly_reports SET content = ${content}, created_at = NOW()
      WHERE user_id = ${userId} AND report_date = ${last.report_date}
    `
    return { userId, weekOf: last.report_date, content }
  }

  // 5+ days since last report — save as a new record
  await sql`
    INSERT INTO weekly_reports (id, user_id, report_date, content)
    VALUES (${`${userId}:${weekOf}`}, ${userId}, ${weekOf}, ${content})
    ON CONFLICT (user_id, report_date) DO UPDATE SET content = EXCLUDED.content, created_at = NOW()
  `

  return { userId, weekOf, content }
}

export const generateReport = inngest.createFunction(
  {
    id: "generate-weekly-report",
    retries: 1,
    triggers: [{ event: "report/generate.requested" }],
  },
  async ({ event, step }) => {
    const { userId } = event.data as { userId: string }
    if (!userId) throw new NonRetriableError("No userId provided")
    return await step.run("generate-report", () => buildAndSaveReport(userId))
  }
)

export const weeklyReportCron = inngest.createFunction(
  {
    id: "weekly-report-cron",
    retries: 1,
    triggers: [{ cron: "0 9 * * 1" }], // Monday 9am
  },
  async ({ step }) => {
    const users = await step.run("get-all-users", async () => {
      const rows = await sql`SELECT DISTINCT user_id FROM github_commits`
      return rows as unknown as { user_id: string }[]
    })

    for (const user of users) {
      await step.run(`report-${user.user_id}`, () => buildAndSaveReport(user.user_id))
    }

    return { status: "weekly-reports-done", count: users.length }
  }
)
