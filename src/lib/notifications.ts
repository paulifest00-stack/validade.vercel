import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/products";
import { getStatus } from "@/lib/expiration";

const STORAGE_KEY = "paulifest:last-notif-date";
const SHOWN_KEY = "paulifest:notified-ids";

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

export function useNotificationPermission() {
  const [perm, setPerm] = useState<NotifPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission as NotifPermission;
  });

  async function request() {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
    const r = await Notification.requestPermission();
    setPerm(r as NotifPermission);
    return r;
  }

  return { permission: perm, request };
}

/** Dispara no máximo 1 notificação por dia, listando produtos vencidos/críticos */
export function useExpirationNotifications(products: Product[] | undefined) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (!products || products.length === 0) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const today = new Date().toISOString().slice(0, 10);
    const last = localStorage.getItem(STORAGE_KEY);
    if (last === today) return;

    const urgent = products.filter((p) => {
      const s = getStatus(p.expiration_date);
      return s === "danger" || s === "critical";
    });
    if (urgent.length === 0) return;

    const shownIds: string[] = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "[]");
    const newOnes = urgent.filter((p) => !shownIds.includes(p.id));
    if (newOnes.length === 0) return;

    try {
      const title =
        urgent.length === 1
          ? `Vencendo: ${urgent[0].name}`
          : `${urgent.length} produtos pedem atenção`;
      const body = urgent
        .slice(0, 4)
        .map((p) => `• ${p.name}`)
        .join("\n") + (urgent.length > 4 ? `\n+${urgent.length - 4} outros` : "");

      new Notification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "paulifest-expiration",
      });

      localStorage.setItem(STORAGE_KEY, today);
      localStorage.setItem(SHOWN_KEY, JSON.stringify(urgent.map((p) => p.id)));
      fired.current = true;
    } catch (e) {
      console.warn("Notification failed", e);
    }
  }, [products]);
}
