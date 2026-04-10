"use client"

import { useState } from "react"

export function SteamConnect() {
  const [open, setOpen] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [steamId, setSteamId] = useState("")
  const [state, setState] = useState<"idle" | "loading" | "error">("idle")
  const [error, setError] = useState("")

  const connect = async () => {
    setState("loading")
    setError("")
    const res = await fetch("/api/steam/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, steamId }),
    })
    if (res.ok) {
      window.location.reload()
    } else {
      setError(await res.text())
      setState("error")
    }
  }

  if (!open) {
    return (
      <a
        onClick={() => setOpen(true)}
        className="text-xs underline text-muted-foreground cursor-pointer"
      >
        Connect Steam
      </a>
    )
  }

  return (
    <div className="rounded-xl bg-card border border-orange-500/20 p-4 space-y-3 max-w-sm">
      <p className="text-sm font-medium text-orange-400">Connect Steam</p>
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Steam API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50"
        />
        <input
          type="text"
          placeholder="Steam ID64 (e.g. 76561198...)"
          value={steamId}
          onChange={(e) => setSteamId(e.target.value)}
          className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={connect}
          disabled={state === "loading" || !apiKey || !steamId}
          className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 transition-colors disabled:opacity-50"
        >
          {state === "loading" ? "Connecting…" : "Connect"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
