import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { CommitsChart } from "@/components/commits-chart"
import { ThemeToggle } from "@/components/theme-toggle"
import { SyncButton } from "@/components/sync-button"
import { SteamConnect } from "@/components/steam-connect"
import { DashboardReportCard } from "@/components/dashboard-report-card"
import { EmailSettings } from "@/components/email-settings"
import Link from "next/link"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ spotify?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { spotify } = await searchParams
  const userId = (session as { login: string }).login

  const [
    spotifyRows,
    commitWeeks,
    commitDays,
    prCount,
    issueCount,
    reviewCount,
    recentPlays,
    topTracks,
    topArtists,
    userRows,
    steamRows,
    steamRecent,
    steamTop,
    latestReport,
  ] = await Promise.all([
    sql`SELECT user_id FROM spotify_tokens WHERE user_id = ${userId}`,
    sql`
      SELECT date_trunc('week', date) as week, COUNT(*)::int as count
      FROM github_commits WHERE user_id = ${userId}
      GROUP BY week ORDER BY week
    `,
    sql`
      SELECT DATE(date) as day, COUNT(*)::int as count
      FROM github_commits
      WHERE user_id = ${userId} AND date >= NOW() - INTERVAL '7 days'
      GROUP BY day ORDER BY day
    `,
    sql`SELECT COUNT(*)::int as count FROM github_prs WHERE user_id = ${userId}`,
    sql`SELECT COUNT(*)::int as count FROM github_issues WHERE user_id = ${userId}`,
    sql`SELECT COUNT(*)::int as count FROM github_reviews WHERE user_id = ${userId}`,
    sql`
      SELECT track_name, artist_names, played_at
      FROM spotify_plays WHERE user_id = ${userId}
      ORDER BY played_at DESC LIMIT 8
    `,
    sql`
      SELECT track_name, artist_names, rank
      FROM spotify_top_tracks
      WHERE user_id = ${userId} AND time_range = 'short_term'
        AND snapshot_date = (
          SELECT MAX(snapshot_date) FROM spotify_top_tracks WHERE user_id = ${userId}
        )
      ORDER BY rank LIMIT 8
    `,
    sql`
      SELECT artist_name, genres, rank
      FROM spotify_top_artists
      WHERE user_id = ${userId} AND time_range = 'short_term'
        AND snapshot_date = (
          SELECT MAX(snapshot_date) FROM spotify_top_artists WHERE user_id = ${userId}
        )
      ORDER BY rank LIMIT 8
    `,
    sql`SELECT email FROM users WHERE id = ${userId}`,
    sql`SELECT user_id FROM steam_config WHERE user_id = ${userId}`,
    sql`
      SELECT app_id, name, playtime_2weeks, playtime_forever
      FROM steam_recently_played WHERE user_id = ${userId}
      ORDER BY playtime_2weeks DESC LIMIT 5
    `,
    sql`
      SELECT app_id, name, playtime_forever FROM steam_games
      WHERE user_id = ${userId}
        AND snapshot_date = (SELECT MAX(snapshot_date) FROM steam_games WHERE user_id = ${userId})
      ORDER BY playtime_forever DESC LIMIT 5
    `,
    sql`
      SELECT content, report_date, created_at FROM weekly_reports
      WHERE user_id = ${userId}
      ORDER BY report_date DESC LIMIT 1
    `,
  ])

  const spotifyConnected = spotifyRows.length > 0
  const steamConnected = steamRows.length > 0
  const currentEmail = (userRows as { email: string | null }[])[0]?.email ?? null
  const commitData = commitWeeks as { week: string; count: number }[]
  const commitDailyData = commitDays as { day: string; count: number }[]
  const report = (latestReport as { content: string; report_date: string; created_at: string }[])[0] ?? null

  return (
    <main className="min-h-screen bg-background text-foreground p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
            Personal Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back, {session.user?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }) }}>
            <button type="submit" className="text-sm text-muted-foreground underline">Sign out</button>
          </form>
        </div>
      </div>

      {spotify === "connected" && (
        <p className="text-sm text-green-500">Spotify connected and syncing…</p>
      )}
      {spotify === "error" && (
        <p className="text-sm text-red-400">Spotify connection failed. Try again.</p>
      )}

      {/* Email settings */}
      <EmailSettings currentEmail={currentEmail} />

      {/* Weekly Report Section */}
      <DashboardReportCard initialReport={report} />

      {/* GitHub Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            GitHub
          </h2>
          <SyncButton />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/30 p-4">
            <p className="text-xs text-muted-foreground">Commits</p>
            <p className="text-3xl font-bold mt-1 text-emerald-400">{commitData.reduce((s, r) => s + r.count, 0)}</p>
          </div>
          <div className="rounded-xl bg-blue-500/5 border border-blue-500/30 p-4">
            <p className="text-xs text-muted-foreground">Pull Requests</p>
            <p className="text-3xl font-bold mt-1 text-blue-400">{(prCount[0] as { count: number }).count}</p>
          </div>
          <div className="rounded-xl bg-violet-500/5 border border-violet-500/30 p-4">
            <p className="text-xs text-muted-foreground">Reviews</p>
            <p className="text-3xl font-bold mt-1 text-violet-400">{(reviewCount[0] as { count: number }).count}</p>
          </div>
        </div>

        {/* Commits chart */}
        <div className="rounded-xl bg-card border border-emerald-500/20 p-4">
          {commitData.length > 0 ? (
            <CommitsChart weeklyData={commitData} dailyData={commitDailyData} />
          ) : (
            <p className="text-sm text-muted-foreground">No commit data yet.</p>
          )}
        </div>
      </section>

      {/* Spotify Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            Spotify
          </h2>
          {!spotifyConnected && (
            <a href="/api/spotify/connect" className="text-xs underline text-muted-foreground">
              Connect Spotify
            </a>
          )}
        </div>

        {spotifyConnected ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Recently played */}
            <div className="rounded-xl bg-card border border-green-500/20 p-4">
              <p className="text-sm font-medium mb-3 text-green-400">Recently played</p>
              <ul className="space-y-2">
                {(recentPlays as { track_name: string; artist_names: string; played_at: string }[]).map((p, i) => (
                  <li key={i} className="text-sm">
                    <p className="font-medium truncate">{p.track_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.artist_names}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Top tracks */}
            <div className="rounded-xl bg-card border border-blue-500/20 p-4">
              <p className="text-sm font-medium mb-3 text-blue-400">Top tracks (4 weeks)</p>
              <ol className="space-y-2">
                {(topTracks as { track_name: string; artist_names: string; rank: number }[]).map((t) => (
                  <li key={t.rank} className="text-sm flex gap-2">
                    <span className="text-muted-foreground w-4 shrink-0">{t.rank}</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{t.track_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.artist_names}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Top artists */}
            <div className="rounded-xl bg-card border border-violet-500/20 p-4">
              <p className="text-sm font-medium mb-3 text-violet-400">Top artists (4 weeks)</p>
              <ol className="space-y-2">
                {(topArtists as { artist_name: string; genres: string; rank: number }[]).map((a) => (
                  <li key={a.rank} className="text-sm flex gap-2">
                    <span className="text-muted-foreground w-4 shrink-0">{a.rank}</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.artist_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.genres.split(",")[0]}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Connect Spotify to see your listening data.</p>
        )}
      </section>

      {/* Steam Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
            Steam
          </h2>
          {!steamConnected && <SteamConnect />}
        </div>

        {steamConnected ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Played this week */}
            <div className="rounded-xl bg-card border border-orange-500/20 p-4">
              <p className="text-sm font-medium mb-3 text-orange-400">Played this week</p>
              {(steamRecent as { app_id: number; name: string; playtime_2weeks: number; playtime_forever: number }[]).length > 0 ? (
                <ul className="space-y-3">
                  {(steamRecent as { app_id: number; name: string; playtime_2weeks: number; playtime_forever: number }[]).map((g) => {
                    const hrs = Math.floor(g.playtime_2weeks / 60)
                    const mins = g.playtime_2weeks % 60
                    return (
                      <li key={g.app_id} className="flex items-center gap-3">
                        <img
                          src={`https://cdn.akamai.steamstatic.com/steam/apps/${g.app_id}/capsule_sm_120.jpg`}
                          alt={g.name}
                          className="w-16 h-6 rounded object-cover shrink-0 opacity-90"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{g.name}</p>
                          <p className="text-xs text-muted-foreground">{hrs}h {mins}m this week</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No games played this week.</p>
              )}
            </div>

            {/* Most played all time */}
            <div className="rounded-xl bg-card border border-orange-500/20 p-4">
              <p className="text-sm font-medium mb-3 text-orange-400">Most played all time</p>
              <ol className="space-y-3">
                {(steamTop as { app_id: number; name: string; playtime_forever: number }[]).map((g, i) => {
                  const hrs = Math.floor(g.playtime_forever / 60)
                  return (
                    <li key={g.app_id} className="flex items-center gap-3">
                      <span className="text-xs text-orange-400 font-bold w-5 text-right shrink-0">#{i + 1}</span>
                      <img
                        src={`https://cdn.akamai.steamstatic.com/steam/apps/${g.app_id}/capsule_sm_120.jpg`}
                        alt={g.name}
                        className="w-16 h-6 rounded object-cover shrink-0 opacity-90"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{g.name}</p>
                        <p className="text-xs text-muted-foreground">{hrs.toLocaleString()}h total</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Connect Steam to see your gaming activity.</p>
        )}
      </section>
    </main>
  )
}
