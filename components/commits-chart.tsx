"use client"

import { useState } from "react"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

type Props = {
  weeklyData: { week: string; count: number }[]
  dailyData: { day: string; count: number }[]
}

const chartConfig = {
  count: { label: "Commits", color: "var(--chart-1)" },
}

export function CommitsChart({ weeklyData = [], dailyData = [] }: Props) {
  const [view, setView] = useState<"week" | "day">("week")

  const data =
    view === "week"
      ? weeklyData.map((d) => ({
          label: new Date(d.week).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          count: d.count,
        }))
      : dailyData.map((d) => ({
          label: new Date(d.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          count: d.count,
        }))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-emerald-400">Commits</p>
        <div className="flex rounded-lg overflow-hidden border border-border text-xs">
          {(["week", "day"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 transition-colors ${
                view === v
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "week" ? "Per week" : "Last 7 days"}
            </button>
          ))}
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-48 w-full">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
