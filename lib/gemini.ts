import { GoogleGenerativeAI } from "@google/generative-ai"

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set")
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function generateWeeklyReport(data: {
  username: string
  weekOf: string
  github: {
    commits: number
    repos: string[]
    prs: number
    reviews: number
  }
  spotify: {
    connected: boolean
    recentTracks: { track: string; artist: string }[]
    topArtists: string[]
  }
  steam: {
    connected: boolean
    recentGames: { name: string; hoursThisWeek: number }[]
  }
}) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

  const sections: string[] = []

  sections.push(`GitHub: ${data.github.commits} commits across ${data.github.repos.length > 0 ? data.github.repos.join(", ") : "no repositories"}, ${data.github.prs} pull requests opened, ${data.github.reviews} code reviews.`)

  if (data.spotify.connected) {
    const tracks = data.spotify.recentTracks.slice(0, 5).map(t => `"${t.track}" by ${t.artist}`).join(", ")
    const artists = data.spotify.topArtists.slice(0, 3).join(", ")
    sections.push(`Spotify: recently played ${tracks || "nothing"}. Top artists this month: ${artists || "none"}.`)
  }

  if (data.steam.connected && data.steam.recentGames.length > 0) {
    const games = data.steam.recentGames.map(g => `${g.name} (${g.hoursThisWeek.toFixed(1)}h)`).join(", ")
    sections.push(`Steam: played ${games}.`)
  } else if (data.steam.connected) {
    sections.push(`Steam: no games played this week.`)
  }

  const prompt = `You are writing a short, friendly personal weekly recap for ${data.username}.
Week of ${data.weekOf}.

Here is their activity data:
${sections.join("\n")}

Write a warm, conversational 3-4 sentence summary of their week. Mention specific details from the data. Keep it personal and upbeat, like a friend summarizing their week. Do not use bullet points or headers — just flowing prose. Do not make up data that isn't provided.`

  const result = await model.generateContent(prompt)
  return result.response.text()
}
