import { read, utils } from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { upsertCatalogEntry } from "@/lib/product-catalog";
import type { Product } from "@/lib/products";

export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

/**
 * Converte data no formato americano M/D/AA para YYYY-MM-DD
 * Exemplo: "10/6/26" -> "2026-10-06"
 */
function parseAmericanDate(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== "string") return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Tenta parse de M/D/AA ou MM/DD/YYYY
  const parts = trimmed.split("/");
  if (parts.length !== 3) return null;

  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;

  // Valida mês e dia
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Converte ano de 2 dígitos para 4 dígitos (assume 20XX)
  const fullYear = year < 100 ? 2000 + year : year;

  // Formata como YYYY-MM-DD
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${fullYear}-${m}-${d}`;
}

/**
 * Valida se um barcode é numérico válido
 */
function isValidBarcode(barcode: string | null | undefined): boolean {
  if (!barcode || typeof barcode !== "string") return false;
  const trimmed = barcode.trim();
  if (!trimmed) return false;
  // Aceita apenas números
  return /^\d+$/.test(trimmed);
}

/**
 * Importa produtos de um arquivo XLSX
 */
export async function importProductsFromXLSX(
  file: File,
  defaultCategoryId: string,
): Promise<ImportResult> {
  const result: ImportResult = {
    created: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Lê o arquivo
    const arrayBuffer = await file.arrayBuffer();
    const workbook = read(arrayBuffer, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!worksheet) {
      result.errors.push("Nenhuma planilha encontrada no arquivo.");
      return result;
    }

    // Converte para JSON
    const rows = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (rows.length === 0) {
      result.errors.push("Planilha vazia.");
      return result;
    }

    // Primeira linha é cabeçalho
    const headers = rows[0] as string[];
    const nameIdx = headers.findIndex((h) => h?.toLowerCase() === "name");
    const barcodeIdx = headers.findIndex((h) => h?.toLowerCase() === "barcode");
    const expirationIdx = headers.findIndex(
      (h) => h?.toLowerCase() === "expiration date",
    );

    if (nameIdx === -1 || expirationIdx === -1) {
      result.errors.push(
        "Colunas obrigatórias não encontradas: Name e/ou Expiration Date.",
      );
      return result;
    }

    // Processa linhas de dados
    const productsToInsert: Partial<Product>[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const name = (row[nameIdx] ?? "").toString().trim();
      if (!name) {
        result.errors.push(`Linha ${i + 1}: Nome vazio — pulada.`);
        result.skipped++;
        continue;
      }

      let barcode: string | null = null;
      if (barcodeIdx !== -1) {
        const barcodeRaw = (row[barcodeIdx] ?? "").toString().trim();
        if (barcodeRaw && isValidBarcode(barcodeRaw)) {
          barcode = barcodeRaw;
        } else if (barcodeRaw) {
          // Barcode inválido (ex: URL) — ignora e deixa como null
          result.errors.push(
            `Linha ${i + 1}: Barcode inválido ("${barcodeRaw}") — cadastrado sem barcode.`,
          );
        }
      }

      const expirationRaw = (row[expirationIdx] ?? "").toString().trim();
      const expiration = parseAmericanDate(expirationRaw);

      if (!expiration) {
        result.errors.push(
          `Linha ${i + 1}: Data de validade inválida ("${expirationRaw}") — pulada.`,
        );
        result.skipped++;
        continue;
      }

      productsToInsert.push({
        name,
        barcode: barcode || null,
        expiration_date: expiration,
        category_id: defaultCategoryId,
        quantity: null,
        photo_url: null,
      });
    }

    // Insert em lote (batch) e upsert no catálogo
    if (productsToInsert.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < productsToInsert.length; i += batchSize) {
        const batch = productsToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from("products").insert(batch);

        if (error) {
          result.errors.push(
            `Erro ao inserir lote ${Math.floor(i / batchSize) + 1}: ${error.message}`,
          );
        } else {
          result.created += batch.length;

          // Faz upsert no product_catalog para cada produto com barcode válido
          for (const product of batch) {
            if (product.barcode) {
              await upsertCatalogEntry(product.barcode, product.name || "", null);
            }
          }
        }
      }
    }

    return result;
  } catch (err) {
    result.errors.push(
      `Erro ao processar arquivo: ${err instanceof Error ? err.message : String(err)}`,
    );
    return result;
  }
}
