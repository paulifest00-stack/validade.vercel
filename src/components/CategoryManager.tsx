import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Category, useDeleteCategory, useSaveCategory } from "@/lib/products";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
};

export function CategoryManager({ open, onClose, categories }: Props) {
  const save = useSaveCategory();
  const del = useDeleteCategory();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function add() {
    const n = newName.trim();
    if (!n) return;
    try {
      await save.mutateAsync({ name: n });
      setNewName("");
      toast.success("Categoria criada");
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "Já existe uma categoria com esse nome." : "Erro ao salvar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Categorias</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Nova categoria"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 py-2"
            >
              {editingId === c.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={async () => {
                      if (editName.trim()) {
                        await save.mutateAsync({ id: c.id, name: editName.trim() });
                        setEditingId(null);
                      }
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{c.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => { setEditingId(c.id); setEditName(c.name); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    disabled={c.name === "Geral"}
                    onClick={async () => {
                      if (confirm(`Excluir categoria "${c.name}"?`)) {
                        await del.mutateAsync(c.id);
                        toast.success("Categoria excluída");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <Button variant="ghost" onClick={onClose}>Fechar</Button>
      </DialogContent>
    </Dialog>
  );
}
