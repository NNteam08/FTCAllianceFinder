"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClientComponentClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useI18n } from "@/components/i18n/LanguageProvider"
import { Flame } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<any>(null)
  const { lang, setLang, t } = useI18n()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const isActive = (path: string) => pathname === path

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="rounded-lg bg-gradient-to-br from-first-blue to-first-orange p-1.5">
                <Flame className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-first-blue to-first-orange bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
                FTC Alliance Finder
              </span>
            </Link>
            <p className="hidden md:block text-sm text-muted-foreground">
              {t("home.tagline")}
            </p>
            {user && (
              <div className="flex space-x-4">
                <Link
                  href="/dashboard"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/dashboard") ? "text-first-blue" : "text-muted-foreground"
                  }`}
                >
                  {t("nav.dashboard")}
                </Link>
                <Link
                  href="/teams"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/teams") ? "text-first-blue" : "text-muted-foreground"
                  }`}
                >
                  {t("nav.teams")}
                </Link>
                <Link
                  href="/events"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/events") ? "text-first-blue" : "text-muted-foreground"
                  }`}
                >
                  {t("nav.events")}
                </Link>
                <Link
                  href="/agreements"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/agreements") ? "text-first-blue" : "text-muted-foreground"
                  }`}
                >
                  {t("nav.agreements")}
                </Link>
                <Link
                  href="/chat"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    pathname.startsWith("/chat") ? "text-first-blue" : "text-muted-foreground"
                  }`}
                >
                  {t("nav.chat")}
                </Link>
                <Link
                  href="/teams/favorites"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    pathname === "/teams/favorites" ? "text-first-blue" : "text-muted-foreground"
                  }`}
                >
                  {t("nav.favorites")}
                </Link>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(lang === "ru" ? "en" : "ru")}
            >
              {lang === "ru" ? "EN" : "RU"}
            </Button>
            {user ? (
              <>
                <span className="text-sm text-muted-foreground">
                  {user.email}
                </span>
                <Button variant="outline" onClick={handleSignOut}>
                  {t("nav.signOut")}
                </Button>
              </>
            ) : (
              <div className="flex space-x-2">
                <Button variant="ghost" asChild>
                  <Link href="/login">{t("nav.signIn")}</Link>
                </Button>
                <Button asChild className="bg-first-blue hover:bg-first-blue/90">
                  <Link href="/register">{t("nav.register")}</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

