import { serve } from "inngest/next"
import { inngest } from "@/inngest/client"
import { githubBackfill, githubWeeklySync } from "@/inngest/functions/github"
import { spotifyBackfill, spotifyWeeklySync } from "@/inngest/functions/spotify"
import { steamBackfill, steamWeeklySync } from "@/inngest/functions/steam"
import { generateReport, weeklyReportCron } from "@/inngest/functions/report"
import { dailyEmailDigest } from "@/inngest/functions/email"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [githubBackfill, githubWeeklySync, spotifyBackfill, spotifyWeeklySync, steamBackfill, steamWeeklySync, generateReport, weeklyReportCron, dailyEmailDigest],
})
