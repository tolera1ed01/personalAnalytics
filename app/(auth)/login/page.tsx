import { signIn } from "@/auth"
import { ThemeToggle } from "@/components/theme-toggle"

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background overflow-hidden relative">
      {/* Background glow orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-80 h-80 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-72 h-72 rounded-full bg-emerald-500/8 blur-3xl" />
      </div>

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Card */}
      <div className="relative z-10 flex flex-col items-center gap-8 rounded-2xl border border-border bg-card/60 backdrop-blur-sm px-10 py-12 shadow-2xl w-full max-w-sm mx-4">
        {/* Logo mark */}
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 via-violet-500/20 to-emerald-500/20 border border-white/10">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="url(#grad)" strokeWidth="1.5">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="50%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5l4-4 3 3 4-5 4 4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18M3 4h18" opacity="0.3" />
          </svg>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
            Personal Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Your code, music, and games — all in one place.
          </p>
        </div>

        {/* Data source pills */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-emerald-500/8 border border-emerald-500/20 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            GitHub
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-green-500/8 border border-green-500/20 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Spotify
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-orange-500/8 border border-orange-500/20 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
            Steam
          </span>
        </div>

        {/* Sign in button */}
        <form
          action={async () => {
            "use server"
            await signIn("github", { redirectTo: "/dashboard" })
          }}
          className="w-full"
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current shrink-0" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>
        </form>

        <p className="text-xs text-muted-foreground/60 text-center">
          Sign in to view your personal dashboard
        </p>
      </div>
    </main>
  )
}
