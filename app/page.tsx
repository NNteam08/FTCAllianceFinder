"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClientComponentClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/layout/navbar";
import { useI18n } from "@/components/i18n/LanguageProvider";
import { BarChart2, Handshake, Zap } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { t } = useI18n();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push("/dashboard");
      }
    };
    checkUser();
  }, [router, supabase]);

  return (
    <>
      <Navbar />
      <main className="flex min-h-[calc(100vh-4rem)] flex-col">
          <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-16">
          <div className="rounded-3xl gradient-hero-warm p-8 md:p-12 text-white text-center max-w-4xl w-full shadow-2xl">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              FTC Alliance Finder
            </h1>
            <p className="text-xl text-white/90 mb-8">
              {t("home.tagline")}
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button asChild size="lg" className="bg-white text-first-blue hover:bg-white/90">
                <Link href="/register">{t("home.cta.getStarted")}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                <Link href="/login">{t("home.cta.signIn")}</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3 mt-12 w-full max-w-5xl">
            <Card className="overflow-hidden border-0 bg-first-blue/20 border-l-4 border-l-first-blue">
              <CardHeader>
                <BarChart2 className="h-10 w-10 text-first-blue mb-2" />
                <CardTitle className="text-foreground">{t("home.feature.stats.title")}</CardTitle>
                <CardDescription>
                  {t("home.feature.stats.desc")}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="overflow-hidden border-0 bg-first-orange/20 border-l-4 border-l-first-orange">
              <CardHeader>
                <Handshake className="h-10 w-10 text-first-orange mb-2" />
                <CardTitle className="text-foreground">{t("home.feature.agreements.title")}</CardTitle>
                <CardDescription>
                  {t("home.feature.agreements.desc")}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="overflow-hidden border-0 bg-emerald-600/20 border-l-4 border-l-emerald-500">
              <CardHeader>
                <Zap className="h-10 w-10 text-emerald-400 mb-2" />
                <CardTitle className="text-foreground">{t("home.feature.compatibility.title")}</CardTitle>
                <CardDescription>
                  {t("home.feature.compatibility.desc")}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}

