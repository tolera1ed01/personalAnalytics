import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { GenerateReportButton } from "@/components/generate-report-button"
import Link from "next/link"

export default async function ReportPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = (session as { login: string }).login

  const reports = await sql`
    SELECT content, report_date, created_at
    FROM weekly_reports
    WHERE user_id = ${userId}
    ORDER BY report_date DESC
    LIMIT 4
  ` as { content: string; report_date: string; created_at: string }[]

  const latest = reports[0] ?? null

  return (
    <main className="min-h-screen bg-background text-foreground p-6 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 inline-block">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
            Weekly Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your week, summarized by Gemini</p>
        </div>
        <GenerateReportButton latestCreatedAt={latest?.created_at} />
      </div>

      {/* Latest report */}
      {latest ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-violet-500/20 bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-violet-400 uppercase tracking-wider">
                Week of {new Date(latest.report_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
              <p className="text-xs text-muted-foreground">
                Generated {new Date(latest.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{latest.content}</p>
          </div>

          {/* Past reports */}
          {reports.length > 1 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Past reports</p>
              {reports.slice(1).map((r) => (
                <div key={r.report_date} className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.report_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{r.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/50 p-10 text-center space-y-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 mx-auto">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-violet-400" fill="currentColor">
              <path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium">No reports yet</p>
            <p className="text-xs text-muted-foreground mt-1">Generate your first weekly summary above</p>
          </div>
        </div>
      )}
    </main>
  )
}
