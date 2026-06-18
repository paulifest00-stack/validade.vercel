import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Keyboard, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
};

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const containerId = "barcode-reader-region";
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    if (!open || manualMode) return;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        const { Html5Qrcode } = mod;
        const el = document.getElementById(containerId);
        if (!el || cancelled) return;
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 260, height: 160 } },
          (decoded) => {
            onDetected(decoded);
            stop();
          },
          () => {},
        );
      } catch (e: any) {
        setError(
          "Não foi possível acessar a câmera. Verifique as permissões ou digite o código manualmente.",
        );
      }
    })();

    const stop = async () => {
      try {
        if (scannerRef.current?.isScanning) await scannerRef.current.stop();
        await scannerRef.current?.clear();
      } catch {}
      scannerRef.current = null;
    };

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, manualMode, onDetected]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-border bg-surface">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="font-display text-xl">
            {manualMode ? "Digitar código" : "Escanear código de barras"}
          </DialogTitle>
        </DialogHeader>

        {!manualMode ? (
          <div className="p-5 pt-3">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
              <div id={containerId} className="absolute inset-0" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-40 w-64 rounded-xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
              </div>
            </div>
            {error && (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            )}
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setManualMode(true)}
              >
                <Keyboard className="h-4 w-4 mr-2" /> Digitar manualmente
              </Button>
              <Button variant="ghost" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-5 pt-3 space-y-3">
            <Input
              autoFocus
              inputMode="numeric"
              placeholder="Código de barras"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manual.trim()) {
                  onDetected(manual.trim());
                }
              }}
            />
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setManualMode(false)}>
                Voltar à câmera
              </Button>
              <Button
                className="flex-1"
                onClick={() => manual.trim() && onDetected(manual.trim())}
              >
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
