import "next-auth"

declare module "next-auth" {
  interface Session {
    login?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    login?: string
  }
}
