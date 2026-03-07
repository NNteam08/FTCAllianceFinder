"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { createClientComponentClient } from "@/lib/supabase/client"
import { useI18n } from "@/components/i18n/LanguageProvider"

export default function LoginPage() {
  const supabase = createClientComponentClient()
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      if (!data.session) throw new Error("auth.login.errorSession")

      const res = await fetch("/api/auth/set-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "auth.login.errorSetSession")
      }

      window.location.href = "/dashboard"
    } catch (error: any) {
      console.error("Login error:", error)
      const msg = error.message === "auth.login.errorSession" || error.message === "auth.login.errorSetSession" ? t(error.message as "auth.login.errorSession" | "auth.login.errorSetSession") : error.message || t("auth.login.errorFallback")
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-border/50 shadow-xl overflow-hidden">
        <div className="gradient-hero p-6 text-white">
          <CardTitle className="text-2xl text-white">{t("auth.login.title")}</CardTitle>
          <CardDescription className="text-white/80 mt-1">
            {t("auth.login.desc")}
          </CardDescription>
        </div>
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.login.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("auth.login.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.login.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-first-blue hover:bg-first-blue/90" disabled={loading}>
              {loading ? t("auth.login.loading") : t("auth.login.submit")}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              {t("auth.login.noAccount")}{" "}
              <Link href="/register" className="text-first-blue hover:underline">
                {t("auth.login.register")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

