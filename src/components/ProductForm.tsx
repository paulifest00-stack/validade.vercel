import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Camera, ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { Category, Product, useSaveProduct } from "@/lib/products";
import { compressImageToDataUrl, fetchOpenFoodFacts } from "@/lib/image";
import { toast } from "sonner";

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
  const [notFoundNotice, setNotFoundNotice] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setBarcode(initial?.barcode ?? "");
    setCategoryId(initial?.category_id ?? defaultCategoryId);
    setExpiration(initial?.expiration_date ?? "");
    setQuantity(initial?.quantity != null ? String(initial.quantity) : "");
    setPhoto(initial?.photo_url ?? null);
    setNotFoundNotice(false);

    // Auto lookup if new product with barcode and no name yet
    if (!initial?.id && initial?.barcode && !initial?.name) {
      lookup(initial.barcode);
    }
  }, [open, initial?.id]);

  async function lookup(code: string) {
    setLookingUp(true);
    setNotFoundNotice(false);
    try {
      const r = await fetchOpenFoodFacts(code);
      if (r.found) {
        if (r.name) setName((prev) => prev || r.name!);
        if (r.imageUrl) {
          try {
            const data = await compressImageToDataUrl(r.imageUrl);
            setPhoto((prev) => prev || data);
          } catch {
            setPhoto((prev) => prev || r.imageUrl!);
          }
        }
      } else {
        setNotFoundNotice(true);
      }
    } finally {
      setLookingUp(false);
    }
  }

  async function onPickPhoto(file: File) {
    try {
      const data = await compressImageToDataUrl(file);
      setPhoto(data);
    } catch {
      toast.error("Não foi possível processar a foto.");
    }
  }

  async function onSubmit() {
    if (!name.trim()) return toast.error("Informe o nome do produto.");
    if (!expiration) return toast.error("Informe a data de validade.");
    if (!categoryId) return toast.error("Escolha uma categoria.");

    await save.mutateAsync({
      id: initial?.id,
      name: name.trim(),
      barcode: barcode.trim() || null,
      category_id: categoryId,
      expiration_date: expiration,
      quantity: quantity ? Number(quantity) : null,
      photo_url: photo,
    });
    toast.success(initial?.id ? "Produto atualizado" : "Produto cadastrado");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-surface border-border max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {initial?.id ? "Editar produto" : "Novo produto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo */}
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-surface-2 border border-border">
              {photo ? (
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Camera className="h-7 w-7" />
                </div>
              )}
              {lookingUp && (
                <div className="absolute inset-0 grid place-items-center bg-black/40">
                  <Loader2 className="h-5 w-5 animate-spin text-accent" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
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
            <div className="rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-xs text-muted-foreground">
              Produto não encontrado na base — preencha os dados manualmente.
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Chocolate ao leite 90g" />
          </div>

          <div className="space-y-1.5">
            <Label>Código de barras</Label>
            <div className="flex gap-2">
              <Input
                value={barcode}
                inputMode="numeric"
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Opcional"
              />
              {barcode && (
                <Button type="button" variant="outline" size="icon" onClick={() => lookup(barcode)}>
                  {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Validade</Label>
              <Input
                type="date"
                value={expiration}
                onChange={(e) => setExpiration(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={onSubmit} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
