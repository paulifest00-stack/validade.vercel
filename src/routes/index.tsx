import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  ScanLine,
  Search,
  Settings2,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { ProductForm } from "@/components/ProductForm";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { CategoryManager } from "@/components/CategoryManager";
import {
  Product,
  useCategories,
  useDeleteProduct,
  useProducts,
} from "@/lib/products";
import { getStatus, statusMeta } from "@/lib/expiration";
import { toast } from "sonner";
const LOGO_URL = "/paulifest-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paulifest Validade" },
      { name: "description", content: "Controle de validade de produtos da loja Paulifest." },
    ],
  }),
  component: Home,
});

type ScanIntent = "add" | "search" | null;

function Home() {
  const products = useProducts();
  const categories = useCategories();
  const del = useDeleteProduct();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [scanIntent, setScanIntent] = useState<ScanIntent>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<Product> | null>(null);
  const [catOpen, setCatOpen] = useState(false);

  const categoryMap = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  );
  const geralId = (categories.data ?? []).find((c) => c.name === "Geral")?.id;

  const filtered = useMemo(() => {
    const list = products.data ?? [];
    const s = search.trim().toLowerCase();
    return list
      .filter((p) => (categoryFilter === "all" ? true : p.category_id === categoryFilter))
      .filter((p) =>
        !s
          ? true
          : p.name.toLowerCase().includes(s) || (p.barcode ?? "").includes(s),
      )
      .map((p) => ({ p, rank: statusMeta[getStatus(p.expiration_date)].rank }))
      .sort((a, b) => a.rank - b.rank || a.p.expiration_date.localeCompare(b.p.expiration_date))
      .map((x) => x.p);
  }, [products.data, search, categoryFilter]);

  const counts = useMemo(() => {
    const list = products.data ?? [];
    let danger = 0, critical = 0, soon = 0, warn = 0, ok = 0;
    for (const p of list) {
      const s = getStatus(p.expiration_date);
      if (s === "danger") danger++;
      else if (s === "critical") critical++;
      else if (s === "soon") soon++;
      else if (s === "warn") warn++;
      else ok++;
    }
    return { danger, critical, soon, warn, ok, urgent: danger + critical };
  }, [products.data]);

  function openNew(barcode?: string) {
    setFormInitial(barcode ? { barcode, category_id: geralId } : { category_id: geralId });
    setFormOpen(true);
  }

  function handleScanned(code: string) {
    const intent = scanIntent;
    setScanIntent(null);
    if (intent === "search") {
      setSearch(code);
    } else {
      openNew(code);
    }
  }

  return (
    <div className="relative z-10 mx-auto min-h-screen w-full max-w-2xl px-4 pb-36 pt-[max(env(safe-area-inset-top),1rem)] sm:pt-10">
      {/* Header with brand logo */}
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <img
            src={LOGO_URL}
            alt="Paulifest — Doces e Embalagens"
            className="h-12 w-auto max-w-full sm:h-14 select-none object-contain object-left"
            draggable={false}
          />

          <h1 className="mt-3 font-display text-2xl font-bold leading-none tracking-tight sm:text-3xl">
            Validade<span className="text-primary">.</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Confeitaria, festas e doces — sempre dentro do prazo.
          </p>
        </div>
        <button
          onClick={() => setCatOpen(true)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-surface text-muted-foreground shadow-[var(--shadow-press)] transition active:scale-95 hover:text-foreground"
          aria-label="Categorias"
        >
          <Settings2 className="h-5 w-5" />
        </button>
      </header>

      {/* Dashboard hero: circular gauge + summary */}
      <DashboardHero
        total={(products.data ?? []).length}
        ok={counts.ok}
        urgent={counts.urgent}
        soonish={counts.soon + counts.warn}
      />

      {/* Status cards */}
      <section className="mb-4 grid grid-cols-3 gap-2">
        <StatCard
          label="Vencidos"
          value={counts.danger}
          color="var(--status-danger)"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Próximos"
          value={counts.critical + counts.soon + counts.warn}
          color="var(--status-critical)"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Em dia"
          value={counts.ok}
          color="var(--status-ok)"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </section>

      {/* Alert banner */}
      <AnimatePresence>
        {counts.urgent > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-[color-mix(in_oklab,var(--primary)_18%,white)] to-[color-mix(in_oklab,var(--status-danger)_14%,white)] px-4 py-3 shadow-[var(--shadow-soft)]"
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 text-primary">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="flex-1 text-sm">
              <div className="font-display font-semibold text-foreground">
                {counts.urgent} produto{counts.urgent === 1 ? "" : "s"} vencendo / vencido{counts.urgent === 1 ? "" : "s"}
              </div>
              <div className="text-xs text-muted-foreground">
                Verifique os itens em destaque abaixo.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + scanner */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou código"
          className="h-13 rounded-2xl border-border bg-surface pl-11 pr-24 text-base shadow-[var(--shadow-press)] focus-visible:ring-2 focus-visible:ring-primary"
          style={{ height: 52 }}
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {search && (
            <button
              onClick={() => setSearch("")}
              className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition active:scale-95 hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setScanIntent("search")}
            className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)] transition active:scale-95 hover:bg-[var(--primary-hover)]"
            aria-label="Escanear código para buscar"
          >
            <ScanLine className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Category chips */}
      <div className="-mx-4 mb-4 overflow-x-auto px-4 no-scrollbar">
        <div className="flex gap-2 pb-1">
          <CategoryChip
            label="Todos"
            active={categoryFilter === "all"}
            onClick={() => setCategoryFilter("all")}
          />
          {(categories.data ?? []).map((c) => (
            <CategoryChip
              key={c.id}
              label={c.name}
              active={categoryFilter === c.id}
              onClick={() => setCategoryFilter(c.id)}
            />
          ))}
        </div>
      </div>

      {/* Products — grouped by urgency */}
      {products.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-surface" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onAdd={() => openNew()} />
      ) : (
        <GroupedList
          items={filtered}
          categoryMap={categoryMap}
          onEdit={(p) => { setFormInitial(p); setFormOpen(true); }}
          onDelete={async (p) => {
            if (confirm(`Excluir "${p.name}"?`)) {
              await del.mutateAsync(p.id);
              toast.success("Produto excluído");
            }
          }}
        />
      )}

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3">
        <div className="relative mx-auto flex max-w-2xl items-center justify-end gap-2 px-4">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => openNew()}
            className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-surface text-foreground shadow-[var(--shadow-card)] transition active:bg-surface-2"
            aria-label="Adicionar manualmente"
          >
            <Plus className="h-5 w-5" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setScanIntent("add")}
            className="group flex h-14 items-center gap-2 rounded-2xl bg-primary px-6 font-display text-base font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:bg-[var(--primary-hover)]"
          >
            <ScanLine className="h-5 w-5" />
            Escanear / Adicionar
          </motion.button>
        </div>
      </div>

      <BarcodeScanner
        open={scanIntent !== null}
        onClose={() => setScanIntent(null)}
        onDetected={handleScanned}
        title={scanIntent === "search" ? "Buscar por código" : "Escanear código de barras"}
      />
      <ProductForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={formInitial}
        categories={categories.data ?? []}
        defaultCategoryId={geralId}
      />
      <CategoryManager
        open={catOpen}
        onClose={() => setCatOpen(false)}
        categories={categories.data ?? []}
      />
    </div>
  );
}

function StatCard({
  label, value, color, icon,
}: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-3 shadow-[var(--shadow-press)]">
      <div
        className="absolute -right-4 -top-4 h-16 w-16 rounded-full blur-2xl opacity-40"
        style={{ background: color }}
      />
      <div className="relative">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span style={{ color }}>{icon}</span> {label}
        </div>
        <div className="mt-1 font-display text-2xl font-bold" style={{ color }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function CategoryChip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`chip touch-min border transition active:scale-95 ${
        active
          ? "chip-active border-transparent"
          : "border-border bg-surface text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-border bg-surface/60 p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
        <ScanLine className="h-6 w-6" />
      </div>
      <h3 className="mt-3 font-display text-lg font-semibold">Nenhum produto cadastrado</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Escaneie um código de barras ou adicione manualmente para começar.
      </p>
      <Button
        className="mt-4 h-12 rounded-xl bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
        onClick={onAdd}
      >
        <Plus className="mr-2 h-4 w-4" /> Adicionar produto
      </Button>
    </div>
  );
}

function DashboardHero({
  total, ok, urgent, soonish,
}: { total: number; ok: number; urgent: number; soonish: number }) {
  const pct = total === 0 ? 0 : Math.round((ok / total) * 100);
  const size = 116;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <section className="mb-4 overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2} cy={size / 2} r={r}
              stroke="color-mix(in oklab, var(--status-ok) 14%, transparent)"
              strokeWidth={stroke} fill="none"
            />
            <circle
              cx={size / 2} cy={size / 2} r={r}
              stroke="var(--status-ok)"
              strokeWidth={stroke} fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c - dash}`}
              style={{ transition: "stroke-dasharray 600ms cubic-bezier(.2,.7,.2,1)" }}
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center leading-none">
              <div className="font-display text-2xl font-bold text-foreground">{pct}%</div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">em dia</div>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Estoque monitorado
          </div>
          <div className="mt-0.5 font-display text-3xl font-bold leading-none text-foreground">
            {total}
            <span className="ml-1 text-sm font-medium text-muted-foreground">
              {total === 1 ? "item" : "itens"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--status-danger)" }} />
              <span className="font-semibold" style={{ color: "var(--status-danger)" }}>{urgent}</span>
              <span className="text-muted-foreground">pedem atenção</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--status-soon)" }} />
              <span className="font-semibold" style={{ color: "var(--status-soon)" }}>{soonish}</span>
              <span className="text-muted-foreground">em breve</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function GroupedList({
  items, categoryMap, onEdit, onDelete,
}: {
  items: Product[];
  categoryMap: Map<string, { id: string; name: string; created_at: string }>;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  const urgent: Product[] = [];
  const soon: Product[] = [];
  const okList: Product[] = [];
  for (const p of items) {
    const s = getStatus(p.expiration_date);
    if (s === "danger" || s === "critical") urgent.push(p);
    else if (s === "soon" || s === "warn") soon.push(p);
    else okList.push(p);
  }
  const groups: Array<{ key: string; title: string; tone: string; list: Product[] }> = [];
  if (urgent.length) groups.push({ key: "u", title: "Resolver agora", tone: "var(--status-danger)", list: urgent });
  if (soon.length) groups.push({ key: "s", title: "Vence em breve", tone: "var(--status-soon)", list: soon });
  if (okList.length) groups.push({ key: "o", title: "Em dia", tone: "var(--status-ok)", list: okList });

  return (
    <div className="space-y-5">
      <AnimatePresence initial={false}>
        {groups.map((g) => (
          <div key={g.key} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: g.tone }} />
              <h2 className="font-display text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: g.tone }}>
                {g.title}
              </h2>
              <span className="text-[11px] font-medium text-muted-foreground">· {g.list.length}</span>
              <div className="ml-2 h-px flex-1 bg-border" />
            </div>
            <div className="space-y-3">
              {g.list.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  category={p.category_id ? categoryMap.get(p.category_id) : undefined}
                  onEdit={() => onEdit(p)}
                  onDelete={() => onDelete(p)}
                />
              ))}
            </div>
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
