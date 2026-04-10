import { auth } from "@/auth"
import { inngest } from "@/inngest/client"

export async function POST() {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const userId = (session as { login: string }).login

  await inngest.send({
    name: "github/backfill.requested",
    data: { userId, username: userId },
  })

  return new Response("OK")
}
