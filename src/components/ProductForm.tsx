import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, ImagePlus, Loader2, RefreshCw, Sparkles, ScanSearch } from "lucide-react";
import { Category, Product, useSaveProduct } from "@/lib/products";
import { compressImageToDataUrl } from "@/lib/image";
import { lookupByBarcode, lookupByPhoto, type LookupSource } from "@/lib/product-lookup";
import { upsertCatalogEntry } from "@/lib/product-catalog";
import { toast } from "sonner";
import { DateWheel } from "@/components/DateWheel";
import { formatDateBR } from "@/lib/expiration";

const SOURCE_LABEL: Record<LookupSource, string> = {
  catalog: "Catálogo permanente",
  cache: "Cache local",
  openfoodfacts: "OpenFoodFacts",
  ai_text: "IA (código)",
  ai_vision: "IA (foto do rótulo)",
  none: "Manual",
};

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: Partial<Product> | null;
  categories: Category[];
  defaultCategoryId?: string;
};

export function ProductForm({ open, onClose, initial, categories, defaultCategoryId }: Props) {
  const save = useSaveProduct();
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [expiration, setExpiration] = useState("");
  const [quantity, setQuantity] = useState<string>("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [visioning, setVisioning] = useState(false);
  const [notFoundNotice, setNotFoundNotice] = useState(false);
  const [source, setSource] = useState<LookupSource | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setBarcode(initial?.barcode ?? "");
    setCategoryId(initial?.category_id ?? defaultCategoryId);
    setExpiration(initial?.expiration_date ?? defaultISO());
    setQuantity(initial?.quantity != null ? String(initial.quantity) : "");
    setPhoto(initial?.photo_url ?? null);
    setNotFoundNotice(false);
    setSource(null);

    if (!initial?.id && initial?.barcode && !initial?.name) {
      runBarcodeLookup(initial.barcode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  async function runBarcodeLookup(code: string) {
    setLookingUp(true);
    setNotFoundNotice(false);
    try {
      const r = await lookupByBarcode(code);
      if (r.name) {
        setName((prev) => prev || r.name!);
        if (r.imageDataUrl) setPhoto((prev) => prev || r.imageDataUrl);
        setSource(r.source);
      } else {
        setNotFoundNotice(true);
        setSource("none");
      }
    } finally {
      setLookingUp(false);
    }
  }

  async function runVisionOnPhoto(dataUrl: string) {
    setVisioning(true);
    try {
      const r = await lookupByPhoto(dataUrl);
      if (r.name) {
        setName((prev) => prev || r.name!);
        setSource("ai_vision");
        setNotFoundNotice(false);
        toast.success("Nome identificado pelo rótulo");
      } else {
        toast.message("Rótulo ilegível — preencha manualmente.");
      }
    } finally {
      setVisioning(false);
    }
  }

  async function onPickPhoto(file: File) {
    try {
      const data = await compressImageToDataUrl(file);
      setPhoto(data);
      // Se ainda não temos nome, tenta identificar pelo rótulo automaticamente.
      if (!name.trim()) {
        runVisionOnPhoto(data);
      }
    } catch {
      toast.error("Não foi possível processar a foto.");
    }
  }

  async function onSubmit() {
    if (!name.trim()) return toast.error("Informe o nome do produto.");
    if (!expiration) return toast.error("Informe a data de validade.");
    if (!categoryId) return toast.error("Escolha uma categoria.");

    const trimmedBarcode = barcode.trim() || null;

    await save.mutateAsync({
      id: initial?.id,
      name: name.trim(),
      barcode: trimmedBarcode,
      category_id: categoryId,
      expiration_date: expiration,
      quantity: quantity ? Number(quantity) : null,
      photo_url: photo,
    });

    // Também faz upsert no product_catalog se houver barcode válido
    if (trimmedBarcode && /^\d+$/.test(trimmedBarcode)) {
      await upsertCatalogEntry(trimmedBarcode, name.trim(), photo);
    }

    toast.success(initial?.id ? "Produto atualizado" : "Produto cadastrado");
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[92vh] rounded-t-3xl border-border bg-background p-0 shadow-[0_-20px_60px_-20px_rgba(60,30,10,0.25)]"
      >
        {/* Grab handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-foreground/15" />
        </div>
        <SheetHeader className="px-5 pt-2 pb-3 text-left">
          <SheetTitle className="font-display text-2xl tracking-tight">
            {initial?.id ? "Editar produto" : "Novo produto"}
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]" style={{ maxHeight: "calc(92vh - 5.5rem)" }}>
          <div className="space-y-5">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-2 border border-border">
                {photo ? (
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Camera className="h-7 w-7" />
                  </div>
                )}
                {(lookingUp || visioning) && (
                  <div className="absolute inset-0 grid place-items-center bg-foreground/40">
                    <Loader2 className="h-5 w-5 animate-spin text-background" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full touch-min rounded-xl"
                  onClick={() => fileRef.current?.click()}
                >
                  {photo ? (
                    <><RefreshCw className="h-4 w-4 mr-2" /> Trocar foto</>
                  ) : (
                    <><ImagePlus className="h-4 w-4 mr-2" /> Adicionar foto</>
                  )}
                </Button>
                {photo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setPhoto(null)}
                  >
                    Remover
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickPhoto(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            {notFoundNotice && (
              <div className="rounded-lg border border-primary/25 bg-[color-mix(in_oklab,var(--primary)_8%,white)] p-3 text-xs">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="flex-1">
                    <div className="font-display text-sm font-semibold text-foreground">
                      Não achei esse código nas bases.
                    </div>
                    <div className="mt-0.5 text-muted-foreground">
                      {photo
                        ? "Posso ler o rótulo da foto enviada para preencher o nome."
                        : "Tire ou envie uma foto da embalagem que eu leio o rótulo pra você."}
                    </div>
                    {photo && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 h-9 rounded-lg border-primary/40 text-primary hover:bg-primary/10"
                        onClick={() => runVisionOnPhoto(photo)}
                        disabled={visioning}
                      >
                        {visioning ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ScanSearch className="mr-2 h-3.5 w-3.5" />
                        )}
                        Identificar pela foto
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {source && source !== "none" && name && (
              <div className="-mt-2 text-[11px] text-muted-foreground">
                Identificado por <span className="font-semibold text-foreground/80">{SOURCE_LABEL[source]}</span> — confira antes de salvar.
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Chocolate ao leite 90g"
                className="h-12 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Código de barras</Label>
              <div className="flex gap-2">
                <Input
                  value={barcode}
                  inputMode="numeric"
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Opcional"
                  className="h-12 rounded-xl"
                />
                {barcode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-xl"
                    onClick={() => runBarcodeLookup(barcode)}
                    disabled={lookingUp}
                  >
                    {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>

            {/* Date wheel */}
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <Label>Validade</Label>
                <span className="font-display text-sm font-semibold text-primary">
                  {expiration ? formatDateBR(expiration) : "—"}
                </span>
              </div>
              <DateWheel value={expiration || undefined} onChange={setExpiration} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="—"
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="sticky bottom-0 -mx-5 mt-2 flex gap-2 border-t border-border bg-background/95 px-5 py-3 backdrop-blur">
              <Button variant="ghost" className="flex-1 h-12 rounded-xl" onClick={onClose}>Cancelar</Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)] hover:bg-[var(--primary-hover)]"
                onClick={onSubmit}
                disabled={save.isPending}
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function defaultISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
