import { supabase } from "@/integrations/supabase/client";

export type CatalogEntry = {
  barcode: string;
  name: string;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Busca um produto no catálogo pelo código de barras
 */
export async function lookupInCatalog(barcode: string): Promise<CatalogEntry | null> {
  if (!barcode || typeof barcode !== "string") return null;

  const code = barcode.trim();
  if (!code) return null;

  try {
    const { data } = await supabase
      .from("product_catalog")
      .select("*")
      .eq("barcode", code)
      .maybeSingle();

    return data as CatalogEntry | null;
  } catch {
    return null;
  }
}

/**
 * Atualiza ou cria uma entrada no catálogo
 */
export async function upsertCatalogEntry(
  barcode: string,
  name: string,
  photoUrl: string | null = null,
): Promise<void> {
  if (!barcode || typeof barcode !== "string" || !name) return;

  const code = barcode.trim();
  if (!code) return;

  try {
    await supabase.from("product_catalog").upsert(
      {
        barcode: code,
        name: name.trim(),
        photo_url: photoUrl || null,
      },
      { onConflict: "barcode" },
    );
  } catch (err) {
    console.error("Erro ao fazer upsert no product_catalog:", err);
  }
}
