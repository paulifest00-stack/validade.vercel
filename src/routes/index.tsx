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
  Sparkles,
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paulifest Validade" },
      { name: "description", content: "Controle de validade de produtos da loja Paulifest." },
    ],
  }),
  component: Home,
});

function Home() {
  const products = useProducts();
  const categories = useCategories();
  const del = useDeleteProduct();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [scannerOpen, setScannerOpen] = useState(false);
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
    let danger = 0, soon = 0, ok = 0, warn = 0;
    for (const p of list) {
      const s = getStatus(p.expiration_date);
      if (s === "danger") danger++;
      else if (s === "soon") soon++;
      else if (s === "warn") warn++;
      else ok++;
    }
    return { danger, soon, warn, ok, urgent: danger + soon };
  }, [products.data]);

  function openNew(barcode?: string) {
    setFormInitial(barcode ? { barcode, category_id: geralId } : { category_id: geralId });
    setFormOpen(true);
  }

  function handleScanned(code: string) {
    setScannerOpen(false);
    openNew(code);
  }

  return (
    <div className="relative z-10 mx-auto min-h-screen w-full max-w-2xl px-4 pb-32 pt-6 sm:pt-10">
      {/* Header */}
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs font-medium text-accent">
            <Sparkles className="h-3 w-3" /> Paulifest
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold leading-none sm:text-4xl">
            Validade<span className="text-primary">.</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Confeitaria, festas e doces — sempre dentro do prazo.
          </p>
        </div>
        <button
          onClick={() => setCatOpen(true)}
          className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface/60 text-muted-foreground transition hover:text-foreground hover:bg-surface-2"
          aria-label="Categorias"
        >
          <Settings2 className="h-5 w-5" />
        </button>
      </header>

      {/* Summary */}
      <section className="mb-4 grid grid-cols-3 gap-2">
        <StatCard
          label="Vencidos"
          value={counts.danger}
          color="var(--status-danger)"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Próximos"
          value={counts.soon + counts.warn}
          color="var(--status-soon)"
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
            className="mb-4 flex items-center gap-3 rounded-2xl border border-destructive/40 bg-gradient-to-r from-destructive/20 to-primary/20 px-4 py-3 shadow-[var(--shadow-glow)]"
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/25 text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="flex-1 text-sm">
              <div className="font-display font-semibold">
                {counts.urgent} produto{counts.urgent === 1 ? "" : "s"} vencendo / vencido{counts.urgent === 1 ? "" : "s"}
              </div>
              <div className="text-xs text-muted-foreground">
                Verifique os itens em vermelho e laranja abaixo.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou código de barras"
          className="h-12 rounded-2xl border-border bg-surface/70 pl-10 backdrop-blur"
        />
      </div>

      {/* Category chips */}
      <div className="-mx-4 mb-4 overflow-x-auto px-4">
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

      {/* Products */}
      {products.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onAdd={() => openNew()} />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                category={p.category_id ? categoryMap.get(p.category_id) : undefined}
                onEdit={() => { setFormInitial(p); setFormOpen(true); }}
                onDelete={async () => {
                  if (confirm(`Excluir "${p.name}"?`)) {
                    await del.mutateAsync(p.id);
                    toast.success("Produto excluído");
                  }
                }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Floating action */}
      <div className="fixed inset-x-0 bottom-0 z-20 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="mx-auto flex max-w-2xl items-center justify-end gap-2 px-4">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => openNew()}
            className="grid h-14 w-14 place-items-center rounded-full border border-border bg-surface/90 text-foreground backdrop-blur shadow-[var(--shadow-card)] transition hover:bg-surface-2"
            aria-label="Adicionar manualmente"
          >
            <Plus className="h-5 w-5" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -2 }}
            onClick={() => setScannerOpen(true)}
            className="group flex h-14 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 font-display text-base font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition"
          >
            <ScanLine className="h-5 w-5" />
            Escanear / Adicionar
          </motion.button>
        </div>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleScanned}
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
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-surface/70 p-3 backdrop-blur"
    >
      <div
        className="absolute -right-4 -top-4 h-16 w-16 rounded-full blur-2xl opacity-50"
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
      className={`chip border ${active ? "chip-active border-transparent" : "border-border bg-surface/60 text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-border bg-surface/40 p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30">
        <ScanLine className="h-6 w-6 text-accent" />
      </div>
      <h3 className="mt-3 font-display text-lg font-semibold">Nenhum produto cadastrado</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Escaneie um código de barras ou adicione manualmente para começar.
      </p>
      <Button className="mt-4" onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" /> Adicionar produto
      </Button>
    </div>
  );
}
