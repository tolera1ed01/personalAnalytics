import "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    login?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
  }
}
