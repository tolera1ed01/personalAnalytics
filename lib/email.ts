import nodemailer from "nodemailer"

if (!process.env.EMAIL_USER) throw new Error("EMAIL_USER environment variable is not set")
if (!process.env.EMAIL_PASS) throw new Error("EMAIL_PASS environment variable is not set")

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export type DailyDigestData = {
  username: string
  email: string
  date: string
  narrative: string
  github: {
    commits: { repo: string; message: string; additions: number; deletions: number }[]
    prsOpened: number
    reviewsSubmitted: number
  }
  spotify: {
    connected: boolean
    tracks: { track_name: string; artist_names: string }[]
  }
  steam: {
    connected: boolean
    recentGames: { name: string; playtime_2weeks: number }[]
  }
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function buildEmailHtml(data: DailyDigestData): string {
  const { username, date, narrative, github, spotify, steam } = data

  const githubRows = github.commits.slice(0, 10).map(c => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #1f2937;">
        <p style="font-size:12px;color:#e5e7eb;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.message)}</p>
        <p style="font-size:11px;color:#6b7280;margin:2px 0 0;">${esc(c.repo)} &nbsp;<span style="color:#34d399;">+${c.additions}</span> <span style="color:#f87171;">-${c.deletions}</span></p>
      </td>
    </tr>
  `).join("")

  const githubSection = github.commits.length > 0 ? `
    <div style="margin-bottom:24px;">
      <p style="font-size:13px;font-weight:600;color:#34d399;margin:0 0 4px;">GitHub</p>
      <p style="font-size:12px;color:#6b7280;margin:0 0 10px;">${github.commits.length} commit${github.commits.length !== 1 ? "s" : ""}${github.prsOpened > 0 ? ` &middot; ${github.prsOpened} PR${github.prsOpened !== 1 ? "s" : ""} opened` : ""}${github.reviewsSubmitted > 0 ? ` &middot; ${github.reviewsSubmitted} review${github.reviewsSubmitted !== 1 ? "s" : ""}` : ""}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${githubRows}</table>
    </div>
  ` : ""

  const spotifyRows = spotify.tracks.slice(0, 10).map(t => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #1f2937;">
        <p style="font-size:12px;color:#e5e7eb;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(t.track_name)}</p>
        <p style="font-size:11px;color:#6b7280;margin:2px 0 0;">${esc(t.artist_names)}</p>
      </td>
    </tr>
  `).join("")

  const spotifySection = spotify.connected && spotify.tracks.length > 0 ? `
    <div style="margin-bottom:24px;">
      <p style="font-size:13px;font-weight:600;color:#4ade80;margin:0 0 4px;">Spotify</p>
      <p style="font-size:12px;color:#6b7280;margin:0 0 10px;">${spotify.tracks.length} track${spotify.tracks.length !== 1 ? "s" : ""} played today</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${spotifyRows}</table>
    </div>
  ` : ""

  const steamRows = steam.recentGames.map(g => {
    const hrs = Math.floor(g.playtime_2weeks / 60)
    const mins = g.playtime_2weeks % 60
    return `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #1f2937;">
          <p style="font-size:12px;color:#e5e7eb;margin:0;">${esc(g.name)}</p>
          <p style="font-size:11px;color:#6b7280;margin:2px 0 0;">${hrs}h ${mins}m this week</p>
        </td>
      </tr>
    `
  }).join("")

  const steamSection = steam.connected && steam.recentGames.length > 0 ? `
    <div style="margin-bottom:24px;">
      <p style="font-size:13px;font-weight:600;color:#fb923c;margin:0 0 4px;">Steam</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${steamRows}</table>
    </div>
  ` : ""

  const noActivity = !githubSection && !spotifySection && !steamSection

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#111827;border-radius:12px 12px 0 0;border:1px solid #1f2937;border-bottom:none;padding:24px 28px;">
            <p style="font-size:11px;color:#6b7280;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">${esc(date)}</p>
            <p style="font-size:20px;font-weight:700;margin:0;color:#e5e7eb;">Your day, ${esc(username)}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#111827;border:1px solid #1f2937;border-top:none;border-bottom:none;padding:20px 28px;">
            <p style="font-size:14px;color:#d1d5db;line-height:1.65;margin:0;">${esc(narrative)}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#111827;border:1px solid #1f2937;border-top:1px solid #1f2937;border-bottom:none;padding:20px 28px;">
            ${githubSection}
            ${spotifySection}
            ${steamSection}
            ${noActivity ? `<p style="font-size:13px;color:#6b7280;margin:0;">No activity recorded today.</p>` : ""}
          </td>
        </tr>
        <tr>
          <td style="background:#0f172a;border-radius:0 0 12px 12px;border:1px solid #1f2937;border-top:none;padding:14px 28px;">
            <p style="font-size:11px;color:#374151;margin:0;">Personal Analytics &middot; Daily Digest</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendDailyDigest(data: DailyDigestData) {
  await transporter.sendMail({
    from: `Personal Analytics <${process.env.EMAIL_USER}>`,
    to: data.email,
    subject: `Your day in review — ${data.date}`,
    html: buildEmailHtml(data),
  })
}
