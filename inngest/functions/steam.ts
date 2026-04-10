import { inngest } from "@/inngest/client"
import {
  getSteamConfig,
  fetchRecentlyPlayed,
  fetchOwnedGames,
  saveRecentlyPlayed,
  saveOwnedGames,
  getAllUsersWithSteam,
} from "@/lib/steam"
import { NonRetriableError } from "inngest"

export const steamBackfill = inngest.createFunction(
  {
    id: "steam-backfill",
    retries: 2,
    triggers: [{ event: "steam/backfill.requested" }],
  },
  async ({ event, step }) => {
    const { userId } = event.data as { userId: string }

    const config = await step.run("get-config", () => getSteamConfig(userId))
    if (!config) throw new NonRetriableError(`No Steam config for user ${userId}`)

    await step.run("sync-recently-played", async () => {
      const games = await fetchRecentlyPlayed(config.api_key, config.steam_id)
      await saveRecentlyPlayed(userId, games)
    })

    await step.run("sync-owned-games", async () => {
      const snapshotDate = new Date().toISOString().split("T")[0]
      const games = await fetchOwnedGames(config.api_key, config.steam_id)
      await saveOwnedGames(userId, games, snapshotDate)
    })

    return { userId, status: "steam-backfill-complete" }
  }
)

export const steamWeeklySync = inngest.createFunction(
  {
    id: "steam-weekly-sync",
    retries: 2,
    triggers: [{ cron: "0 2 * * 0" }],
  },
  async ({ step }) => {
    const users = await step.run("get-all-steam-users", () => getAllUsersWithSteam())

    for (const user of users) {
      await step.run(`sync-steam-${user.user_id}`, async () => {
        const config = await getSteamConfig(user.user_id)
        if (!config) return
        const snapshotDate = new Date().toISOString().split("T")[0]
        const [recent, owned] = await Promise.all([
          fetchRecentlyPlayed(config.api_key, config.steam_id),
          fetchOwnedGames(config.api_key, config.steam_id),
        ])
        await saveRecentlyPlayed(user.user_id, recent)
        await saveOwnedGames(user.user_id, owned, snapshotDate)
      })
    }

    return { status: "steam-weekly-sync-complete", userCount: users.length }
  }
)
