"use client"

import { useState, useEffect, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"

export function GenerateReportButton({ latestCreatedAt }: { latestCreatedAt?: string }) {
  const [polling, setPolling] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const baselineRef = useRef<string | undefined>(latestCreatedAt)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => () => stopPolling(), [])

  const generate = async () => {
    setPolling(true)
    baselineRef.current = latestCreatedAt
    await fetch("/api/report/generate", { method: "POST" })

    pollRef.current = setInterval(async () => {
      const res = await fetch("/api/report/latest")
      if (!res.ok) return
      const data = (await res.json()) as { created_at: string } | null
      if (data && data.created_at !== baselineRef.current) {
        stopPolling()
        setPolling(false)
        startTransition(() => {
          router.refresh()
        })
      }
    }, 3000)

    // Safety timeout
    setTimeout(() => {
      stopPolling()
      setPolling(false)
    }, 180_000)
  }

  const loading = polling || isPending

  return (
    <button
      onClick={generate}
      disabled={loading}
      className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 transition-colors disabled:opacity-50"
    >
      {loading ? (
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
  )
}
