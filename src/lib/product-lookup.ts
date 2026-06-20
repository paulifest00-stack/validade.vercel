// Orquestrador da cascata de lookup de produtos (client-side).
// Ordem: cache (Supabase) → OpenFoodFacts → IA texto (EAN) → IA visão (foto).
import { supabase } from "@/integrations/supabase/client";
import { compressImageToDataUrl, fetchOpenFoodFacts } from "@/lib/image";
import { aiLookupByBarcode, aiVisionReadLabel } from "@/lib/ai-lookup.functions";

export type LookupSource =
  | "cache"
  | "openfoodfacts"
  | "ai_text"
  | "ai_vision"
  | "none";

export type LookupResult = {
  name: string | null;
  imageDataUrl: string | null;
  source: LookupSource;
};

/** Cascata por código de barras (sem foto). */
export async function lookupByBarcode(barcode: string): Promise<LookupResult> {
  const code = barcode.trim();
  if (!code) return { name: null, imageDataUrl: null, source: "none" };

  // 1) Cache local (já cadastrado)
  try {
    const { data } = await supabase
      .from("products")
      .select("name, photo_url")
      .eq("barcode", code)
      .limit(1)
      .maybeSingle();
    if (data?.name) {
      return { name: data.name, imageDataUrl: data.photo_url ?? null, source: "cache" };
    }
  } catch {
    /* ignore cache failure */
  }

  // 2) OpenFoodFacts (gratuito, sem chave)
  try {
    const off = await fetchOpenFoodFacts(code);
    if (off.found && off.name) {
      let img: string | null = null;
      if (off.imageUrl) {
        try {
          img = await compressImageToDataUrl(off.imageUrl);
        } catch {
          img = off.imageUrl;
        }
      }
      return { name: off.name, imageDataUrl: img, source: "openfoodfacts" };
    }
  } catch {
    /* next */
  }

  // 3) IA por código (Gemini)
  try {
    const ai = await aiLookupByBarcode({ data: { barcode: code } });
    if (ai?.name) {
      return { name: ai.name, imageDataUrl: null, source: "ai_text" };
    }
  } catch {
    /* next */
  }

  return { name: null, imageDataUrl: null, source: "none" };
}

/** Último recurso: lê rótulo da foto via IA de visão. */
export async function lookupByPhoto(imageDataUrl: string): Promise<LookupResult> {
  try {
    const ai = await aiVisionReadLabel({ data: { imageDataUrl } });
    if (ai?.name) {
      return { name: ai.name, imageDataUrl, source: "ai_vision" };
    }
  } catch {
    /* ignore */
  }
  return { name: null, imageDataUrl, source: "none" };
}
