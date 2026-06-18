export type ExpirationStatus = "danger" | "soon" | "warn" | "ok";

export function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function getStatus(dateStr: string): ExpirationStatus {
  const d = daysUntil(dateStr);
  if (d < 7) return "danger";
  if (d <= 14) return "soon";
  if (d <= 30) return "warn";
  return "ok";
}

export const statusMeta: Record<
  ExpirationStatus,
  { label: string; color: string; bg: string; rank: number }
> = {
  danger: { label: "Vencido / crítico", color: "var(--status-danger)", bg: "color-mix(in oklab, var(--status-danger) 22%, transparent)", rank: 0 },
  soon:   { label: "Vence em breve",    color: "var(--status-soon)",   bg: "color-mix(in oklab, var(--status-soon) 22%, transparent)",   rank: 1 },
  warn:   { label: "Atenção",           color: "var(--status-warn)",   bg: "color-mix(in oklab, var(--status-warn) 22%, transparent)",   rank: 2 },
  ok:     { label: "Em dia",            color: "var(--status-ok)",     bg: "color-mix(in oklab, var(--status-ok) 22%, transparent)",     rank: 3 },
};

export function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function relativeLabel(dateStr: string): string {
  const d = daysUntil(dateStr);
  if (d < 0) return `Vencido há ${Math.abs(d)} dia${Math.abs(d) === 1 ? "" : "s"}`;
  if (d === 0) return "Vence hoje";
  if (d === 1) return "Vence amanhã";
  return `Vence em ${d} dias`;
}
