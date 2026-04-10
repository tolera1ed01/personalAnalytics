export interface GitHubCommit {
  repo: string
  sha: string
  message: string
  date: string
  additions: number
  deletions: number
}

export interface GitHubPR {
  repo: string
  number: number
  title: string
  state: "open" | "closed" | "merged"
  opened_at: string
  merged_at: string | null
}

export interface GitHubIssue {
  repo: string
  number: number
  title: string
  state: "open" | "closed"
  opened_at: string
  closed_at: string | null
}

export interface GitHubReview {
  repo: string
  pr_number: number
  submitted_at: string
  state: string
}

export interface WeeklyReport {
  id: string
  user_id: string
  week_start: string
  content: string
  generated_at: string
}
