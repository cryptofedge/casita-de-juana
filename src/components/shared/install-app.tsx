"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, EllipsisVertical, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** Chrome/Edge/Samsung Internet's install offer, kept by installBootScript() (src/lib/pwa.ts) until it is used. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global {
  interface Window {
    __cdjInstall?: InstallEvent | null;
  }
}

type Device = "server" | "installed" | "apple" | "android" | "other";
type Platform = "apple" | "android";
const DISMISS_KEY = "cdj-install-dismissed";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  window.addEventListener("cdj-install", onChange);
  window.addEventListener("storage", onChange);
  mq.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("cdj-install", onChange);
    window.removeEventListener("storage", onChange);
    mq.removeEventListener("change", onChange);
  };
}
function getDevice(): Device {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "apple";
  if (/android/i.test(ua)) return "android";
  return "other";
}
const getCanPrompt = () => !!window.__cdjInstall;
function getDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}
const useDevice = () => useSyncExternalStore<Device>(subscribe, getDevice, () => "server");

/** "Download the app" button: opens a chooser for Apple (iPhone/iPad) or Android. Hidden inside the installed app. */
export function DownloadAppButton({ className, variant = "default" }: { className?: string; variant?: "default" | "outline" }) {
  const { t } = useT();
  const device = useDevice();
  if (device === "server" || device === "installed") return null;
  return (
    <FormDialog
      trigger={
        <Button variant={variant} className={className}>
          <Download /> {t("Download the app")}
        </Button>
      }
      title="Download the app"
      description="Choose your phone or tablet."
    >
      <InstallChooser device={device} />
    </FormDialog>
  );
}

function InstallChooser({ device }: { device: Device }) {
  const { t } = useT();
  const canPrompt = useSyncExternalStore(subscribe, getCanPrompt, () => false);
  const [picked, setPicked] = useState<Platform | null>(null);
  const platform: Platform = picked ?? (device === "apple" ? "apple" : "android");

  const install = async () => {
    const offer = window.__cdjInstall;
    if (!offer) return;
    await offer.prompt();
    await offer.userChoice;
    window.__cdjInstall = null; // the browser's offer can only be used once
    window.dispatchEvent(new Event("cdj-install"));
  };

  const tab = (p: Platform, label: string, sub: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={platform === p}
      onClick={() => setPicked(p)}
      className={cn(
        "flex flex-1 flex-col items-center rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
        platform === p ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary",
      )}
    >
      {label}
      <span className={cn("text-xs font-normal", platform === p ? "text-primary-foreground/80" : "text-muted-foreground")}>{sub}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={t("Choose your device")} className="flex gap-1 rounded-xl border bg-secondary/40 p-1">
        {tab("apple", t("Apple"), t("iPhone · iPad"))}
        {tab("android", t("Android"), t("Phone · Tablet"))}
      </div>

      {platform === "apple" ? (
        <ol className="space-y-3 text-sm">
          <Step n={1}>
            {t("Open this page in Safari, then tap Share")} <Share className="inline size-4 align-text-bottom text-primary" aria-hidden />
            <span className="block text-xs text-muted-foreground">{t("Bottom bar on iPhone, top bar on iPad.")}</span>
          </Step>
          <Step n={2}>
            {t("Choose “Add to Home Screen”.")} <SquarePlus className="inline size-4 align-text-bottom text-primary" aria-hidden />
          </Step>
          <Step n={3}>{t("Tap “Add”. Casita appears on your home screen.")}</Step>
        </ol>
      ) : canPrompt && device !== "apple" ? (
        <div className="space-y-2">
          <Button size="lg" className="w-full" onClick={install}>
            <Download /> {t("Install now")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t("Casita appears on your home screen like any other app.")}</p>
        </div>
      ) : (
        <ol className="space-y-3 text-sm">
          <Step n={1}>
            {t("Open this page in Chrome, then tap the menu")} <EllipsisVertical className="inline size-4 align-text-bottom text-primary" aria-hidden />
          </Step>
          <Step n={2}>{t("Choose “Install app” (or “Add to Home screen”).")}</Step>
          <Step n={3}>{t("Tap “Install”. Casita appears on your home screen.")}</Step>
        </ol>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-info-soft text-xs font-semibold text-primary">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

/**
 * Card inviting the user to get the app (with the Download button). Hidden inside the installed app.
 * The "banner" variant can be dismissed and only shows on phones and tablets.
 */
export function InstallApp({ variant = "card" }: { variant?: "card" | "banner" }) {
  const { t } = useT();
  const device = useDevice();
  const dismissed = useSyncExternalStore(subscribe, getDismissed, () => false);

  if (device === "server" || device === "installed") return null;
  if (variant === "banner" && (dismissed || device === "other")) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode: the banner just shows again next time */
    }
    window.dispatchEvent(new Event("cdj-install"));
  };

  return (
    <Card className="border-primary/30 p-4">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 size-6 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{t("Get the Casita app")}</div>
          <p className="text-sm text-muted-foreground">{t("Its own icon on your home screen, full screen, no browser bar.")}</p>
          <DownloadAppButton className="mt-3 w-full sm:w-auto" />
        </div>
        {variant === "banner" && (
          <button type="button" onClick={dismiss} aria-label={t("Not now")} className="-m-1 rounded-md p-1 text-muted-foreground hover:bg-secondary">
            <X className="size-5" />
          </button>
        )}
      </div>
    </Card>
  );
}
