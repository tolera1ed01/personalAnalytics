import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { fetchAuthenticatedUser, upsertUser } from "@/lib/github"
import { inngest } from "@/inngest/client"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub({ issuer: "https://github.com/login/oauth" })],
  callbacks: {
    async signIn({ account }) {
      if (account?.access_token) {
        try {
          const profile = await fetchAuthenticatedUser(account.access_token)
          const isNew = await upsertUser(profile, account.access_token)

          if (isNew) {
            await inngest.send({
              name: "github/backfill.requested",
              data: { userId: profile.login, username: profile.login },
            })
          }
        } catch (e) {
          console.error("[auth] Failed to upsert user:", e)
        }
      }
      return true
    },
    async jwt({ token, account, profile }) {
      if (profile) {
        token.login = (profile as { login: string }).login
      }
      return token
    },
    async session({ session, token }) {
      session.login = token.login as string
      return session
    },
  },
})
