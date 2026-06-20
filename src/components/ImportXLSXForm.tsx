import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { importProductsFromXLSX } from "@/lib/import-xlsx";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  defaultCategoryId: string;
};

export function ImportXLSXForm({ open, onClose, defaultCategoryId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  function handleFileSelect(file: File | null) {
    if (file && file.name.endsWith(".xlsx")) {
      setSelectedFile(file);
      setImportResult(null);
    } else if (file) {
      toast.error("Por favor, selecione um arquivo .xlsx válido.");
    }
  }

  async function handleImport() {
    if (!selectedFile) {
      toast.error("Selecione um arquivo primeiro.");
      return;
    }

    setIsImporting(true);
    try {
      const result = await importProductsFromXLSX(selectedFile, defaultCategoryId);
      setImportResult(result);

      if (result.created > 0) {
        toast.success(`${result.created} produto(s) importado(s) com sucesso!`);
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} erro(s) durante a importação.`);
      }
    } catch (err) {
      toast.error(
        `Erro na importação: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsImporting(false);
    }
  }

  function handleClose() {
    setSelectedFile(null);
    setImportResult(null);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        side="bottom"
        className="h-auto max-h-[90vh] rounded-t-3xl border-border bg-background p-0 shadow-[0_-20px_60px_-20px_rgba(60,30,10,0.25)]"
      >
        {/* Grab handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-foreground/15" />
        </div>

        <SheetHeader className="px-5 pt-2 pb-3 text-left">
          <SheetTitle className="font-display text-2xl tracking-tight">
            Importar produtos
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          <div className="space-y-5">
            {/* File upload area */}
            {!importResult && (
              <>
                <div
                  className="relative rounded-lg border-2 border-dashed border-border bg-surface/50 p-6 text-center transition cursor-pointer hover:border-primary/50"
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileUp className="h-8 w-8 text-muted-foreground" />
                    <div className="font-display font-semibold">
                      {selectedFile ? selectedFile.name : "Selecione um arquivo .xlsx"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedFile
                        ? "Clique para trocar o arquivo"
                        : "Clique ou arraste um arquivo aqui"}
                    </div>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f);
                      e.target.value = "";
                    }}
                  />
                </div>

                {selectedFile && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedFile(null)}
                    >
                      Limpar
                    </Button>
                    <Button
                      className="flex-1 bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
                      onClick={handleImport}
                      disabled={isImporting}
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importando...
                        </>
                      ) : (
                        "Importar"
                      )}
                    </Button>
                  </div>
                )}

                {!selectedFile && (
                  <div className="rounded-lg border border-primary/25 bg-[color-mix(in_oklab,var(--primary)_8%,white)] p-3 text-xs">
                    <div className="font-display text-sm font-semibold text-foreground">
                      Formato esperado:
                    </div>
                    <ul className="mt-2 space-y-1 text-muted-foreground list-disc list-inside">
                      <li>Colunas: Name, Barcode, Expiration Date</li>
                      <li>Datas no formato M/D/AA (ex: 10/6/26 = 6 de outubro de 2026)</li>
                      <li>Barcodes devem ser numéricos</li>
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* Import result */}
            {importResult && (
              <div className="space-y-3">
                {importResult.created > 0 && (
                  <div className="rounded-lg border border-green-500/25 bg-green-500/10 p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      <div className="flex-1">
                        <div className="font-display font-semibold text-green-700">
                          {importResult.created} produto(s) criado(s)
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {importResult.skipped > 0 && (
                  <div className="rounded-lg border border-yellow-500/25 bg-yellow-500/10 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                      <div className="flex-1">
                        <div className="font-display font-semibold text-yellow-700">
                          {importResult.skipped} linha(s) pulada(s)
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {importResult.errors.length > 0 && (
                  <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      <div className="flex-1">
                        <div className="font-display font-semibold text-red-700">
                          {importResult.errors.length} erro(s) encontrado(s):
                        </div>
                        <ul className="mt-2 space-y-1 text-xs text-red-600 list-disc list-inside">
                          {importResult.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
                  onClick={() => {
                    handleClose();
                  }}
                >
                  Fechar
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
