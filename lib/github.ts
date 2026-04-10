import { sql } from "@/lib/db"

const GITHUB_API = "https://api.github.com"

// ─── API helpers ────────────────────────────────────────────────────────────

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
}

/** Follow GitHub's Link: <url>; rel="next" pagination for array responses */
async function paginate<T>(initialUrl: string, token: string): Promise<T[]> {
  const results: T[] = []
  let nextUrl: string | null = initialUrl

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { headers: headers(token) })
    if (!res.ok) break

    const data = (await res.json()) as T[]
    results.push(...data)

    const link = res.headers.get("link") ?? ""
    const match = link.match(/<([^>]+)>;\s*rel="next"/)
    nextUrl = match ? match[1] : null
  }

  return results
}

/** Follow GitHub's Link pagination for search endpoints that return { items: T[] } */
async function paginateSearch<T>(initialUrl: string, token: string): Promise<T[]> {
  const results: T[] = []
  let nextUrl: string | null = initialUrl

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { headers: headers(token) })
    if (!res.ok) break

    const data = (await res.json()) as { items: T[] }
    results.push(...(data.items ?? []))

    const link = res.headers.get("link") ?? ""
    const match = link.match(/<([^>]+)>;\s*rel="next"/)
    nextUrl = match ? match[1] : null
  }

  return results
}

// ─── Fetchers ────────────────────────────────────────────────────────────────

export async function fetchAuthenticatedUser(token: string) {
  const res = await fetch(`${GITHUB_API}/user`, { headers: headers(token) })
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`)
  return res.json() as Promise<{ id: number; login: string; name: string | null; email: string | null; avatar_url: string }>
}

export async function fetchRepos(token: string, username: string) {
  return paginate<{ full_name: string; name: string; owner: { login: string } }>(
    `${GITHUB_API}/users/${username}/repos?type=owner&per_page=100`,
    token
  )
}

export async function fetchCommits(
  token: string,
  username: string,
  repo: string,
  since: Date,
  until: Date
) {
  const params = new URLSearchParams({
    author: username,
    since: since.toISOString(),
    until: until.toISOString(),
    per_page: "100",
  })
  return paginate<{
    sha: string
    commit: { message: string; author: { date: string } }
    stats?: { additions: number; deletions: number }
  }>(`${GITHUB_API}/repos/${repo}/commits?${params}`, token)
}

export async function fetchCommitDetail(token: string, repo: string, sha: string) {
  const res = await fetch(`${GITHUB_API}/repos/${repo}/commits/${sha}`, {
    headers: headers(token),
  })
  if (!res.ok) return null
  return res.json() as Promise<{
    sha: string
    commit: { message: string; author: { date: string } }
    stats: { additions: number; deletions: number }
  }>
}

export async function fetchPRs(token: string, username: string, since: Date) {
  const q = `type:pr author:${username} created:>=${since.toISOString().split("T")[0]}`
  return paginateSearch<{
    id: number
    number: number
    title: string
    state: string
    repository_url: string
    created_at: string
    pull_request?: { merged_at: string | null }
  }>(`${GITHUB_API}/search/issues?q=${encodeURIComponent(q)}&per_page=100`, token)
}

export async function fetchIssues(token: string, username: string, since: Date) {
  const q = `type:issue author:${username} created:>=${since.toISOString().split("T")[0]}`
  return paginateSearch<{
    id: number
    number: number
    title: string
    state: string
    repository_url: string
    created_at: string
    closed_at: string | null
  }>(`${GITHUB_API}/search/issues?q=${encodeURIComponent(q)}&per_page=100`, token)
}

export async function fetchReviewEvents(token: string, username: string) {
  const events = await paginate<{
    type: string
    created_at: string
    repo: { name: string }
    payload: {
      action: string
      review?: { state: string; submitted_at: string }
      pull_request?: { number: number }
    }
  }>(`${GITHUB_API}/users/${username}/events?per_page=100`, token)

  return events.filter((e) => e.type === "PullRequestReviewEvent" && e.payload.review)
}

// ─── Repo name from URL helper ───────────────────────────────────────────────

function repoFromUrl(url: string) {
  // https://api.github.com/repos/owner/repo → owner/repo
  return url.replace(`${GITHUB_API}/repos/`, "")
}

// ─── Database writes ─────────────────────────────────────────────────────────

export async function upsertUser(
  profile: {
    id: number
    login: string
    name: string | null
    email: string | null
    avatar_url: string
  },
  accessToken?: string
): Promise<boolean> {
  const result = await sql`
    INSERT INTO users (id, github_id, name, email, avatar, access_token)
    VALUES (${profile.login}, ${String(profile.id)}, ${profile.name}, ${profile.email}, ${profile.avatar_url}, ${accessToken ?? null})
    ON CONFLICT (github_id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      avatar = EXCLUDED.avatar,
      access_token = COALESCE(EXCLUDED.access_token, users.access_token)
    RETURNING (xmax = 0) AS inserted
  `
  return (result[0] as { inserted: boolean }).inserted
}

export async function getAllUsersWithTokens() {
  const rows = await sql`SELECT id, access_token FROM users WHERE access_token IS NOT NULL`
  return rows as unknown as { id: string; access_token: string }[]
}

export async function saveCommits(
  userId: string,
  repo: string,
  commits: Awaited<ReturnType<typeof fetchCommitDetail>>[]
) {
  for (const commit of commits) {
    if (!commit) continue
    await sql`
      INSERT INTO github_commits (id, user_id, repo, sha, message, date, additions, deletions)
      VALUES (
        ${`${userId}:${commit.sha}`},
        ${userId},
        ${repo},
        ${commit.sha},
        ${commit.commit.message.split("\n")[0].slice(0, 500)},
        ${commit.commit.author.date},
        ${commit.stats.additions},
        ${commit.stats.deletions}
      )
      ON CONFLICT (user_id, sha) DO NOTHING
    `
  }
}

export async function savePRs(
  userId: string,
  prs: Awaited<ReturnType<typeof fetchPRs>>
) {
  for (const pr of prs) {
    const repo = repoFromUrl(pr.repository_url)
    await sql`
      INSERT INTO github_prs (id, user_id, repo, number, title, state, opened_at, merged_at)
      VALUES (
        ${`${userId}:${repo}:${pr.number}`},
        ${userId},
        ${repo},
        ${pr.number},
        ${pr.title},
        ${pr.pull_request?.merged_at ? "merged" : pr.state},
        ${pr.created_at},
        ${pr.pull_request?.merged_at ?? null}
      )
      ON CONFLICT (user_id, repo, number) DO UPDATE SET
        state = EXCLUDED.state,
        merged_at = EXCLUDED.merged_at
    `
  }
}

export async function saveIssues(
  userId: string,
  issues: Awaited<ReturnType<typeof fetchIssues>>
) {
  for (const issue of issues) {
    const repo = repoFromUrl(issue.repository_url)
    await sql`
      INSERT INTO github_issues (id, user_id, repo, number, title, state, opened_at, closed_at)
      VALUES (
        ${`${userId}:${repo}:${issue.number}`},
        ${userId},
        ${repo},
        ${issue.number},
        ${issue.title},
        ${issue.state},
        ${issue.created_at},
        ${issue.closed_at ?? null}
      )
      ON CONFLICT (user_id, repo, number) DO UPDATE SET
        state = EXCLUDED.state,
        closed_at = EXCLUDED.closed_at
    `
  }
}

export async function saveReviews(
  userId: string,
  events: Awaited<ReturnType<typeof fetchReviewEvents>>
) {
  for (const event of events) {
    const review = event.payload.review!
    const prNumber = event.payload.pull_request!.number
    await sql`
      INSERT INTO github_reviews (id, user_id, repo, pr_number, submitted_at, state)
      VALUES (
        ${`${userId}:${event.repo.name}:${prNumber}:${review.submitted_at}`},
        ${userId},
        ${event.repo.name},
        ${prNumber},
        ${review.submitted_at},
        ${review.state}
      )
      ON CONFLICT (user_id, repo, pr_number, submitted_at) DO NOTHING
    `
  }
}
