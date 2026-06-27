import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Keyboard, X, AlertCircle } from "lucide-react";

// Valida checksum de EAN-13, EAN-8 e UPC-A (12 dígitos).
function isValidBarcodeChecksum(code: string): boolean {
  if (!/^\d+$/.test(code)) return true; // não numérico (Code128/39): não validamos checksum
  if (![8, 12, 13].includes(code.length)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  // EAN-13 e UPC-A (12): pesos alternados a partir da direita
  // EAN-8: idem
  let sum = 0;
  const reversed = digits.reverse();
  reversed.forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  const calc = (10 - (sum % 10)) % 10;
  return calc === check;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
};

export function BarcodeScanner({ open, onClose, onDetected, title }: Props) {
  const containerId = "barcode-reader-region";
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const votesRef = useRef<Map<string, number>>(new Map());
  const acceptedRef = useRef<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Inicializa o scanner com Quagga2 para melhor precisão em códigos de barras 1D
  useEffect(() => {
    if (!open || manualMode) return;
    let cancelled = false;
    votesRef.current = new Map();
    acceptedRef.current = false;

    (async () => {
      try {
        // Importação dinâmica para evitar erros no SSR
        const { default: Quagga } = await import("@ericblade/quagga2");

        if (cancelled) return;

        const el = document.getElementById(containerId);
        if (!el) return;

        setIsScanning(true);
        setError(null);

        // Configuração otimizada do Quagga2 para códigos de barras
        await Quagga.init(
          {
            inputStream: {
              name: "Live",
              type: "LiveStream",
              target: el,
              constraints: {
                width: { min: 1280, ideal: 1920 },
                height: { min: 720, ideal: 1080 },
                facingMode: "environment",
                // @ts-ignore - advanced constraints
                advanced: [{ focusMode: "continuous" }],
              } as any,
            },
            decoder: {
              readers: [
                "ean_reader",
                "ean_8_reader",
                "upc_reader",
                "upc_e_reader",
                "code_128_reader",
                "code_39_reader",
                "codabar_reader",
                "i2of5_reader",
              ],
              
              debug: {
                showCanvas: false,
                showPatternLabels: false,
                showFrequency: false,
                showSkeleton: false,
                showScatter: false,
                logLevel: 0,
              },
            },
            locator: {
              halfSample: false,
              patchSize: "large",
            },
            numOfWorkers: navigator.hardwareConcurrency
              ? Math.min(4, navigator.hardwareConcurrency)
              : 2,
            frequency: 15,
          },
          (err: any) => {
            if (err) {
              console.error("Quagga init error:", err);
              if (!cancelled) {
                setError("Não foi possível inicializar a câmera. Tente novamente.");
                setIsScanning(false);
              }
            }
          },
        );

        if (cancelled) {
          await Quagga.stop();
          return;
        }

        // Listener com votação: exige N leituras consistentes + checksum válido
        const REQUIRED_VOTES = 3;
        const MAX_ERROR = 0.15;
        const onDetectedHandler = (result: any) => {
          if (acceptedRef.current) return;
          const cr = result?.codeResult;
          const code: string | undefined = cr?.code?.trim();
          if (!code) return;

          // Filtra leituras com baixa qualidade (erro médio alto por dígito)
          const decoded: any[] = cr.decodedCodes ?? [];
          const errs = decoded
            .map((d) => (typeof d.error === "number" ? d.error : null))
            .filter((v): v is number => v !== null);
          const avgErr = errs.length
            ? errs.reduce((a, b) => a + b, 0) / errs.length
            : 0;
          if (avgErr > MAX_ERROR) return;

          // Checksum (EAN/UPC)
          if (!isValidBarcodeChecksum(code)) return;

          const next = (votesRef.current.get(code) ?? 0) + 1;
          votesRef.current.set(code, next);

          if (next >= REQUIRED_VOTES) {
            acceptedRef.current = true;
            handleDetected(code);
          }
        };

        Quagga.onDetected(onDetectedHandler);
        scannerRef.current = { Quagga, onDetected: onDetectedHandler };

        Quagga.start();
      } catch (e: any) {
        console.error("Scanner error:", e);
        if (!cancelled) {
          setError(
            "Câmera indisponível. Digite o código manualmente ou verifique as permissões.",
          );
          setIsScanning(false);
        }
      }
    })();

    const handleDetected = (code: string) => {
      // feedback tátil quando disponível
      try {
        navigator.vibrate?.(60);
      } catch {
        /* no-op */
      }
      onDetected(code);
      stop();
    };


    const stop = async () => {
      try {
        if (scannerRef.current?.Quagga) {
          const { Quagga } = scannerRef.current;
          if (scannerRef.current.onDetected) {
            Quagga.offDetected(scannerRef.current.onDetected);
          }
          await Quagga.stop();
        }
      } catch (e) {
        console.error("Error stopping scanner:", e);
      }
      scannerRef.current = null;
      setIsScanning(false);
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
            {manualMode ? "Digitar código" : (title ?? "Escanear código de barras")}
          </DialogTitle>
        </DialogHeader>

        {!manualMode ? (
          <div className="p-5 pt-3">
            <div className="scanner-frame relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
              <div id={containerId} className="absolute inset-0" />
              {/* Guia visual para o usuário */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-4/5 h-1/3 border-2 border-green-500 rounded-lg opacity-60" />
              </div>
              {/* Indicador de status */}
              {isScanning && (
                <div className="absolute top-3 right-3 flex items-center gap-2 bg-green-500/80 text-white px-3 py-1 rounded-full text-xs font-medium">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  Escaneando
                </div>
              )}
            </div>
            {error && (
              <div className="mt-3 flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
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
