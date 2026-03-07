"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClientComponentClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function TeamSettingsPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [team, setTeam] = useState<any>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [socialLinks, setSocialLinks] = useState({
    youtube: "",
    instagram: "",
    telegram: "",
    website: "",
  });

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("team_id, teams(*)")
        .eq("id", user.id)
        .single();

      if (!userData?.teams) {
        router.push("/teams");
        return;
      }

      // Supabase relation teams(*) может вернуть объект или массив
      const raw = userData.teams;
      const t = Array.isArray(raw) ? raw[0] ?? null : raw;
      if (!t) {
        router.push("/teams");
        return;
      }

      setTeam(t);
      setName(t.name || "");
      setDescription(t.description || "");
      setAvatarUrl(t.avatar_url || "");
      setSocialLinks({
        youtube: t.social_links?.youtube || "",
        instagram: t.social_links?.instagram || "",
        telegram: t.social_links?.telegram || "",
        website: t.social_links?.website || "",
      });

      setLoading(false);
    };

    loadData();
  }, [router, supabase]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверяем тип файла
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: t("teamSettings.chooseImage") });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: t("teamSettings.maxSize") });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "team-avatars");
      formData.append("folder", team.id);

      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t("teamSettings.uploadError"));
      }

      const data = await res.json();
      setAvatarUrl(data.url);
      setMessage({ type: "success", text: t("teamSettings.avatarUploaded") });
    } catch (error) {
      console.error("Upload error:", error);
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("teamSettings.uploadError") });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("teams")
        .update({
          name,
          description,
          avatar_url: avatarUrl || null,
          social_links: socialLinks,
        })
        .eq("id", team.id);

      if (error) throw error;

      setMessage({ type: "success", text: t("teamSettings.profileSaved") });
    } catch (error) {
      console.error("Save error:", error);
      setMessage({ type: "error", text: t("teamSettings.saveError") });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">{t("common.loading")}</div>;
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t("teamSettings.teamNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("teamSettings.title")}</h1>
        <p className="text-muted-foreground">
          Team {team.number}
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-500/10 text-green-600 border border-green-500/30"
              : "bg-destructive/10 text-destructive border border-destructive/30"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Avatar */}
      <Card>
        <CardHeader>
          <CardTitle>{t("teamSettings.avatarTitle")}</CardTitle>
          <CardDescription>{t("teamSettings.avatarDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-first-blue text-white text-2xl">
                {team.number}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarUpload}
                accept="image/*"
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? t("common.loading") : t("teamSettings.uploadPhoto")}
              </Button>
              {avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAvatarUrl("")}
                  className="text-muted-foreground"
                >
                  {t("teamSettings.removeAvatar")}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">{t("teamSettings.avatarHint")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("teamSettings.infoTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("teamSettings.teamName")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("teamSettings.teamNamePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("teamSettings.description")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("teamSettings.descriptionPlaceholder")}
              rows={5}
            />
            <p className="text-xs text-muted-foreground">{t("teamSettings.descriptionHint")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("teamSettings.socialTitle")}</CardTitle>
          <CardDescription>{t("teamSettings.socialDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="youtube">YouTube</Label>
            <Input
              id="youtube"
              value={socialLinks.youtube}
              onChange={(e) => setSocialLinks({ ...socialLinks, youtube: e.target.value })}
              placeholder="https://youtube.com/@yourteam"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              value={socialLinks.instagram}
              onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
              placeholder="https://instagram.com/yourteam"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telegram">Telegram</Label>
            <Input
              id="telegram"
              value={socialLinks.telegram}
              onChange={(e) => setSocialLinks({ ...socialLinks, telegram: e.target.value })}
              placeholder="https://t.me/yourteam"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">{t("teamSettings.website")}</Label>
            <Input
              id="website"
              value={socialLinks.website}
              onChange={(e) => setSocialLinks({ ...socialLinks, website: e.target.value })}
              placeholder="https://yourteam.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? t("teamSettings.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
