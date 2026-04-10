import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import crypto from "crypto"

const SCOPES = [
  "user-read-recently-played",
  "user-top-read",
].join(" ")

export async function GET() {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = (session as { login: string }).login
  const nonce = crypto.randomUUID()
  const state = `${userId}:${nonce}`

  const cookieStore = await cookies()
  cookieStore.set("spotify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  })

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    scope: SCOPES,
    state,
  })

  redirect(`https://accounts.spotify.com/authorize?${params}`)
}
