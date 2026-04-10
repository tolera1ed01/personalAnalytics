"use client"

import { useState } from "react"

export function SyncButton() {
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle")

  const sync = async () => {
    setState("syncing")
    try {
      const res = await fetch("/api/sync", { method: "POST" })
      setState(res.ok ? "done" : "error")
    } catch {
      setState("error")
    }
    setTimeout(() => setState("idle"), 3000)
  }

  return (
    <button
      onClick={sync}
      disabled={state === "syncing"}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={state === "syncing" ? "animate-spin" : ""}
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
      {state === "idle" && "Sync now"}
      {state === "syncing" && "Syncing…"}
      {state === "done" && "Synced!"}
      {state === "error" && "Failed"}
    </button>
  )
}
