"use client"

import { useState } from "react"

export function EmailSettings({ currentEmail }: { currentEmail: string | null }) {
  const [email, setEmail] = useState(currentEmail ?? "")
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  async function save() {
    setStatus("saving")
    const res = await fetch("/api/user/email", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    setStatus(res.ok ? "saved" : "error")
    setTimeout(() => setStatus("idle"), 2000)
  }

  return (
    <div className="rounded-xl bg-card border border-border p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">Daily digest email</p>
        <p className="text-xs text-muted-foreground">We'll send you a recap of your day every evening.</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="text-sm bg-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring w-52"
        />
        <button
          onClick={save}
          disabled={status === "saving" || email === currentEmail}
          className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved!" : status === "error" ? "Error" : "Save"}
        </button>
      </div>
    </div>
  )
}
