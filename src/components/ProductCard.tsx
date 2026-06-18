import { motion } from "framer-motion";
import { Pencil, Trash2, Package, Calendar, Barcode } from "lucide-react";
import { Product, Category } from "@/lib/products";
import { formatDateBR, getStatus, relativeLabel, statusMeta } from "@/lib/expiration";

type Props = {
  product: Product;
  category?: Category;
  onEdit: () => void;
  onDelete: () => void;
};

export function ProductCard({ product, category, onEdit, onDelete }: Props) {
  const status = getStatus(product.expiration_date);
  const meta = statusMeta[status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur shadow-[var(--shadow-card)]"
    >
      <div
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ background: meta.color }}
      />
      <div className="flex gap-3 p-3 pl-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-2">
          {product.photo_url ? (
            <img src={product.photo_url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <Package className="h-7 w-7" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 font-display font-semibold leading-tight">
              {product.name}
            </h3>
            <span
              className="chip shrink-0 text-[0.68rem]"
              style={{ background: meta.bg, color: meta.color }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
              />
              {meta.label}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {category && <span className="font-medium text-foreground/80">{category.name}</span>}
            {product.barcode && (
              <span className="inline-flex items-center gap-1">
                <Barcode className="h-3 w-3" /> {product.barcode}
              </span>
            )}
            {product.quantity != null && <span>Qtd: {product.quantity}</span>}
          </div>

          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" /> {formatDateBR(product.expiration_date)}
              </div>
              <div
                className="font-display text-sm font-semibold"
                style={{ color: meta.color }}
              >
                {relativeLabel(product.expiration_date)}
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={onEdit}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                aria-label="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-destructive/20 hover:text-destructive"
                aria-label="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
