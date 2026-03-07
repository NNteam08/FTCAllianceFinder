"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { createClientComponentClient } from "@/lib/supabase/client"
import { useI18n } from "@/components/i18n/LanguageProvider"

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [teamNumber, setTeamNumber] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Регистрация пользователя
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      if (authData.user) {
        // Создание записи пользователя
        const { error: userError } = await supabase
          .from("users")
          .insert({
            id: authData.user.id,
            email,
            display_name: displayName || null,
            role: "team_member",
          })

        if (userError) throw userError

        // Если указан номер команды, создаем или находим команду
        if (teamNumber) {
          const teamNum = parseInt(teamNumber)
          if (!isNaN(teamNum)) {
            // Проверяем, существует ли команда
            const { data: existingTeam } = await supabase
              .from("teams")
              .select("id")
              .eq("number", teamNum)
              .single()

            let teamId: string

            if (existingTeam) {
              teamId = existingTeam.id
            } else {
              // Создаем новую команду
              const { data: newTeam, error: teamError } = await supabase
                .from("teams")
                .insert({
                  number: teamNum,
                  name: `Team ${teamNum}`,
                })
                .select("id")
                .single()

              if (teamError) throw teamError
              teamId = newTeam.id
            }

            // Привязываем пользователя к команде
            await supabase
              .from("users")
              .update({ team_id: teamId })
              .eq("id", authData.user.id)
          }
        }
      }

      // Принудительно обновляем страницу для установки cookies
      window.location.href = "/dashboard"
    } catch (error: any) {
      console.error("Register error:", error)
      setError(error.message || t("auth.register.errorFallback"))
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-border/50 shadow-xl overflow-hidden">
        <div className="gradient-hero p-6 text-white">
          <CardTitle className="text-2xl text-white">{t("auth.register.title")}</CardTitle>
          <CardDescription className="text-white/80 mt-1">
            {t("auth.register.desc")}
          </CardDescription>
        </div>
        <CardContent className="pt-6">
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.register.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("auth.register.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.register.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">{t("auth.register.displayName")}</Label>
              <Input
                id="displayName"
                type="text"
                placeholder={t("auth.register.displayNamePlaceholder")}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamNumber">{t("auth.register.teamNumber")}</Label>
              <Input
                id="teamNumber"
                type="number"
                placeholder={t("auth.register.teamNumberPlaceholder")}
                value={teamNumber}
                onChange={(e) => setTeamNumber(e.target.value)}
              autoComplete="off"
              />
            </div>
            <Button type="submit" className="w-full bg-first-blue hover:bg-first-blue/90" disabled={loading}>
              {loading ? t("auth.register.loading") : t("auth.register.submit")}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              {t("auth.register.haveAccount")}{" "}
              <Link href="/login" className="text-first-blue hover:underline">
                {t("auth.register.signIn")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

