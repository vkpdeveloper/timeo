"use client";

import { SW_URL } from "@/lib/pwa";

// Browser side of Web Push: permission, subscribe, unsubscribe.

export type PushSupport = "unsupported" | "needs-install" | "denied" | "default" | "granted";

const urlBase64ToUint8Array = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  // iOS only allows Web Push for apps added to the Home Screen (iOS 16.4+)
  if (ios && !standalone) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return Notification.permission as PushSupport;
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

export async function currentSubscription() {
  if (pushSupport() === "unsupported") return null;
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

/** Asks permission (must be called from a tap) and subscribes this device. */
export async function subscribePush(): Promise<PushSubscriptionJSON | null> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error("Push isn't configured on the server yet");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
  return sub.toJSON();
}

export async function unsubscribePush(): Promise<string | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
