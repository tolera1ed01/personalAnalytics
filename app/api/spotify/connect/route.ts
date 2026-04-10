import { auth } from "@/auth"
import { redirect } from "next/navigation"

const SCOPES = [
  "user-read-recently-played",
  "user-top-read",
].join(" ")

export async function GET() {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = (session as { login: string }).login

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    scope: SCOPES,
    state: userId,
  })

  redirect(`https://accounts.spotify.com/authorize?${params}`)
}
