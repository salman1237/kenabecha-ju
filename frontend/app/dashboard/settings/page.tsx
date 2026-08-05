"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { FieldError } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartImage } from "@/components/ui/SmartImage";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { updateProfile, updateWhatsAppNumber, uploadAvatar } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={staggerItem}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-soft-xs)]"
    >
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </motion.section>
  );
}

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp_number ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const onAvatar = async (file: File) => {
    setUploading(true);
    try {
      setUser(await uploadAvatar(file));
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upload photo.");
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ full_name: fullName.trim(), bio: bio.trim() || null });
      setUser(await updateWhatsAppNumber(whatsapp.trim() || null));
      toast.success("Settings saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      variants={staggerContainer(0.06)}
      initial="hidden"
      animate="visible"
      className="flex max-w-2xl flex-col gap-6"
    >
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your public profile and contact options.</p>
      </motion.div>

      <Section title="Profile photo" description="Shown on your listings, reviews, and chats.">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploading}
            className="group relative size-16 shrink-0 overflow-hidden rounded-full"
            title="Change photo"
          >
            <SmartImage
              src={user.avatar_url}
              alt=""
              fallback={<span className="text-xl font-semibold">{user.full_name.charAt(0).toUpperCase()}</span>}
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? "…" : "Change"}
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAvatar(f);
              e.target.value = "";
            }}
          />
          <p className="text-xs text-muted-foreground">JPEG, PNG or WEBP · up to 5MB</p>
        </div>
      </Section>

      <Section title="Public profile">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="full_name">Display name</Label>
          <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
      </Section>

      <Section
        title="Contact options"
        description="How buyers can reach you from your listings."
      >
        <div className="flex flex-col gap-1.5">
          <Label>Verified phone</Label>
          <Input value={user.phone ?? "Not set"} disabled />
          <p className="text-xs text-muted-foreground">
            Set during JU verification — buyers see a Call button using this number.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="whatsapp">WhatsApp number</Label>
          <Input
            id="whatsapp"
            placeholder="01XXXXXXXXX"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Leave blank to hide the WhatsApp button.</p>
        </div>
      </Section>

      <Section title="JU verification">
        {user.profile_complete ? (
          <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-4" />
            Verified — {user.student_id} · {user.department?.name ?? "—"}
          </p>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              Complete your JU student verification to open a shop or list items.
            </p>
            <Link href="/complete-profile" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Complete verification
            </Link>
          </div>
        )}
      </Section>

      <motion.div variants={staggerItem} className="flex flex-col gap-2">
        <FieldError>{error}</FieldError>
        <Button onClick={onSave} loading={saving} loadingText="Saving…" className="self-start">
          Save changes
        </Button>
      </motion.div>
    </motion.div>
  );
}
