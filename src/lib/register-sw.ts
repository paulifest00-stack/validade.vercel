// Service worker registration, guarded against Lovable preview/dev contexts.
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  try {
    if (window.top !== window.self) return; // inside iframe (preview)
  } catch {
    return;
  }

  const host = window.location.hostname;
  const url = new URL(window.location.href);
  const isPreviewHost =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");
  const killSwitch = url.searchParams.get("sw") === "off";

  if (isPreviewHost || killSwitch) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        if (r.active?.scriptURL?.endsWith("/sw.js")) r.unregister();
      });
    }).catch(() => {});
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
