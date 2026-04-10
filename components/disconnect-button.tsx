"use client"

import { useState } from "react"

export function DisconnectButton({ service, endpoint }: { service: string; endpoint: string }) {
  const [status, setStatus] = useState<"idle" | "confirming" | "loading">("idle")

  async function disconnect() {
    setStatus("loading")
    await fetch(endpoint, { method: "DELETE" })
    window.location.reload()
  }

  if (status === "confirming") {
    return (
      <span className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Disconnect {service}?</span>
        <button onClick={disconnect} className="text-red-400 underline">Yes</button>
        <button onClick={() => setStatus("idle")} className="text-muted-foreground underline">No</button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setStatus("confirming")}
      className="text-xs text-muted-foreground underline"
    >
      Disconnect
    </button>
  )
}
