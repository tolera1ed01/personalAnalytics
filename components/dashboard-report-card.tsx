"use client"

import { useState, useRef } from "react"
import Link from "next/link"

type Report = { content: string; report_date: string; created_at: string } | null

export function DashboardReportCard({ initialReport }: { initialReport: Report }) {
  const [report, setReport] = useState(initialReport)
  const [polling, setPolling] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const baselineRef = useRef<string | undefined>(initialReport?.created_at)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const generate = async () => {
    setPolling(true)
    baselineRef.current = report?.created_at
    await fetch("/api/report/generate", { method: "POST" })

    pollRef.current = setInterval(async () => {
      const res = await fetch("/api/report/latest", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as Report
      if (data && data.created_at !== baselineRef.current) {
        stopPolling()
        setPolling(false)
        setReport(data)
      }
    }, 3000)

    setTimeout(() => {
      stopPolling()
      setPolling(false)
    }, 180_000)
  }

  return (
    <section className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2 text-violet-400">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z" />
          </svg>
          Weekly Report
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={generate}
            disabled={polling}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 transition-colors disabled:opacity-50"
          >
            {polling ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z" />
                </svg>
                Generate Report
              </>
            )}
          </button>
          <Link
            href="/report"
            className="text-xs px-3 py-1.5 rounded-lg border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors"
          >
            View all
          </Link>
        </div>
      </div>

      {report ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {new Date(report.report_date).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">{report.content}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No report yet — hit Generate Report to create your first one.
        </p>
      )}
    </section>
  )
}
