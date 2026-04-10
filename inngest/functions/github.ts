import { inngest } from "@/inngest/client"
import { sql } from "@/lib/db"
import {
  fetchRepos,
  fetchCommits,
  fetchCommitDetail,
  fetchPRs,
  fetchIssues,
  fetchReviewEvents,
  saveCommits,
  savePRs,
  saveIssues,
  saveReviews,
  getAllUsersWithTokens,
} from "@/lib/github"
import { NonRetriableError } from "inngest"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthRange(monthsAgo: number): { since: Date; until: Date } {
  const now = new Date()
  const since = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
  const until = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1)
  return { since, until }
}

async function getTokenForUser(userId: string): Promise<string> {
  const rows = await sql`SELECT access_token FROM users WHERE id = ${userId}` as { access_token: string | null }[]
  const token = rows[0]?.access_token
  if (!token) throw new NonRetriableError(`No access token for user ${userId}`)
  return token
}

async function syncCommitsForMonth(
  userId: string,
  username: string,
  token: string,
  since: Date,
  until: Date
) {
  const repos = await fetchRepos(token, username)

  for (const repo of repos) {
    const commits = await fetchCommits(token, username, repo.full_name, since, until)

    // Fetch stats for each commit individually (list endpoint omits stats)
    const detailed = await Promise.all(
      commits.slice(0, 30).map((c) => fetchCommitDetail(token, repo.full_name, c.sha))
    )
    await saveCommits(userId, repo.full_name, detailed)
  }
}

// ─── Backfill — 6 months of history, one step per month ──────────────────────

export const githubBackfill = inngest.createFunction(
  {
    id: "github-backfill",
    retries: 2,
    triggers: [{ event: "github/backfill.requested" }],
  },
  async ({ event, step }) => {
    const { userId, username } = event.data as { userId: string; username: string }

    const token = await step.run("get-token", () => getTokenForUser(userId))

    // Commits: one step per month (keeps each step under Vercel's timeout)
    for (let i = 5; i >= 0; i--) {
      await step.run(`sync-commits-month-${i}`, async () => {
        const { since, until } = monthRange(i)
        await syncCommitsForMonth(userId, username, token, since, until)
      })
    }

    // PRs, issues, reviews: single step each (search API is fast)
    await step.run("sync-prs", async () => {
      const since = monthRange(5).since
      const prs = await fetchPRs(token, username, since)
      await savePRs(userId, prs)
    })

    await step.run("sync-issues", async () => {
      const since = monthRange(5).since
      const issues = await fetchIssues(token, username, since)
      await saveIssues(userId, issues)
    })

    await step.run("sync-reviews", async () => {
      const events = await fetchReviewEvents(token, username)
      await saveReviews(userId, events)
    })

    return { userId, status: "backfill-complete" }
  }
)

// ─── Weekly sync — every Sunday at midnight UTC ───────────────────────────────

export const githubWeeklySync = inngest.createFunction(
  {
    id: "github-weekly-sync",
    retries: 2,
    triggers: [{ cron: "0 0 * * 0" }],
  },
  async ({ step }) => {
    const users = await step.run("get-all-users", () => getAllUsersWithTokens())

    for (const user of users) {
      await step.run(`sync-user-${user.id}`, async () => {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        const until = new Date()
        const token = user.access_token

        // Commits for the past week
        const rows = await sql`SELECT id FROM users WHERE id = ${user.id}` as { id: string }[]
        const username = rows[0]?.id
        if (!username) return

        await syncCommitsForMonth(user.id, username, token, since, until)

        const prs = await fetchPRs(token, username, since)
        await savePRs(user.id, prs)

        const issues = await fetchIssues(token, username, since)
        await saveIssues(user.id, issues)

        const events = await fetchReviewEvents(token, username)
        await saveReviews(user.id, events)
      })
    }

    return { status: "weekly-sync-complete", userCount: users.length }
  }
)
