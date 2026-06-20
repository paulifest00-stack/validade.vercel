import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuração do Supabase
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Erro: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão definidas.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Converte data do Excel para formato YYYY-MM-DD
 * O Excel armazena datas como números (dias desde 1900-01-01)
 */
function formatDateFromExcel(excelDate) {
  if (excelDate === null || excelDate === undefined) return null;

  // Se for um objeto Date
  if (excelDate instanceof Date) {
    const year = excelDate.getFullYear();
    const month = String(excelDate.getMonth() + 1).padStart(2, "0");
    const day = String(excelDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Se for um número (serial date do Excel)
  if (typeof excelDate === "number") {
    // Excel serial date: 1 = 1900-01-01
    // Mas há um bug histórico: 1900 não é bissexto no Excel
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (excelDate - 1) * 24 * 60 * 60 * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Se for string no formato YYYY-MM-DD HH:MM:SS (do Excel)
  if (typeof excelDate === "string") {
    // Tenta parse de YYYY-MM-DD HH:MM:SS
    const isoMatch = excelDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    // Tenta parse de M/D/AA
    const parts = excelDate.trim().split("/");
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);

      if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
        const fullYear = year < 100 ? 2000 + year : year;
        const m = String(month).padStart(2, "0");
        const d = String(day).padStart(2, "0");
        return `${fullYear}-${m}-${d}`;
      }
    }
  }

  return null;
}

/**
 * Valida se um barcode é numérico
 */
function isValidBarcode(barcode) {
  if (!barcode || typeof barcode !== "string") return false;
  const trimmed = barcode.toString().trim();
  return /^\d+$/.test(trimmed);
}

/**
 * Processa a planilha e retorna os dados
 */
async function processSpreadsheet(filePath) {
  console.log(`📂 Lendo arquivo: ${filePath}`);

  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (rows.length < 2) {
    throw new Error("Planilha vazia ou sem dados.");
  }

  const headers = rows[0];
  const nameIdx = headers.findIndex((h) => h?.toLowerCase() === "name");
  const barcodeIdx = headers.findIndex((h) => h?.toLowerCase() === "barcode");
  const expirationIdx = headers.findIndex((h) => h?.toLowerCase() === "expiration date");
  const categoryIdx = headers.findIndex((h) => h?.toLowerCase() === "category");

  if (nameIdx === -1 || expirationIdx === -1) {
    throw new Error("Colunas obrigatórias não encontradas: Name e/ou Expiration Date.");
  }

  const products = [];
  const catalogEntries = new Map(); // Para evitar duplicatas no catálogo

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const name = (row[nameIdx] ?? "").toString().trim();
    if (!name) {
      console.warn(`⚠️  Linha ${i + 1}: Nome vazio — pulada.`);
      continue;
    }

    let barcode = null;
    if (barcodeIdx !== -1) {
      const barcodeRaw = (row[barcodeIdx] ?? "").toString().trim();
      if (barcodeRaw && isValidBarcode(barcodeRaw)) {
        barcode = barcodeRaw;
      }
    }

    const expirationRaw = row[expirationIdx];
    const expiration = formatDateFromExcel(expirationRaw);

    if (!expiration) {
      console.warn(`⚠️  Linha ${i + 1}: Data de validade inválida — pulada.`);
      continue;
    }

    // Obtém a categoria (padrão: "Doces" ou "Geral")
    const categoryName = categoryIdx !== -1 ? (row[categoryIdx] ?? "").toString().trim() : "";

    products.push({
      name,
      barcode: barcode || null,
      expiration_date: expiration,
      category_name: categoryName || "Doces",
    });

    // Adiciona ao catálogo (sem duplicatas)
    if (barcode) {
      catalogEntries.set(barcode, { barcode, name });
    }
  }

  return { products, catalogEntries };
}

/**
 * Obtém o ID da categoria pelo nome
 */
async function getCategoryId(categoryName) {
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("name", categoryName)
    .maybeSingle();

  if (error) {
    console.error(`❌ Erro ao buscar categoria: ${error.message}`);
    return null;
  }

  return data?.id || null;
}

/**
 * Insere produtos em lote
 */
async function insertProducts(products, categoryMap) {
  console.log(`\n📦 Inserindo ${products.length} produtos...`);

  const batchSize = 50;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    // Resolve category IDs
    const productsWithCategoryId = await Promise.all(
      batch.map(async (p) => {
        let categoryId = categoryMap.get(p.category_name);
        if (!categoryId) {
          categoryId = await getCategoryId(p.category_name);
          if (categoryId) {
            categoryMap.set(p.category_name, categoryId);
          }
        }
        return {
          name: p.name,
          barcode: p.barcode,
          expiration_date: p.expiration_date,
          category_id: categoryId || null,
          quantity: null,
          photo_url: null,
        };
      }),
    );

    const { error } = await supabase.from("products").insert(productsWithCategoryId);

    if (error) {
      console.error(`❌ Erro ao inserir lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      failed += batch.length;
    } else {
      inserted += batch.length;
      console.log(`✅ Lote ${Math.floor(i / batchSize) + 1} inserido (${inserted}/${products.length})`);
    }
  }

  return { inserted, failed };
}

/**
 * Popula o catálogo permanente
 */
async function populateCatalog(catalogEntries) {
  console.log(`\n📚 Populando catálogo com ${catalogEntries.size} entradas únicas...`);

  const entries = Array.from(catalogEntries.values());
  const batchSize = 50;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);

    const { error } = await supabase.from("product_catalog").upsert(batch, {
      onConflict: "barcode",
    });

    if (error) {
      console.error(
        `❌ Erro ao popular catálogo lote ${Math.floor(i / batchSize) + 1}: ${error.message}`,
      );
      failed += batch.length;
    } else {
      inserted += batch.length;
      console.log(
        `✅ Catálogo lote ${Math.floor(i / batchSize) + 1} inserido (${inserted}/${entries.length})`,
      );
    }
  }

  return { inserted, failed };
}

/**
 * Função principal
 */
async function main() {
  try {
    const filePath = path.join(__dirname, "../upload/beep_2026-06-20.xlsx");

    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    console.log("🚀 Iniciando importação de dados...\n");

    // Processa a planilha
    const { products, catalogEntries } = await processSpreadsheet(filePath);
    console.log(`✅ Planilha processada: ${products.length} produtos encontrados`);

    // Insere produtos
    const categoryMap = new Map();
    const { inserted: productsInserted, failed: productsFailed } = await insertProducts(
      products,
      categoryMap,
    );

    // Popula catálogo
    const { inserted: catalogInserted, failed: catalogFailed } = await populateCatalog(
      catalogEntries,
    );

    // Resumo
    console.log("\n" + "=".repeat(50));
    console.log("📊 RESUMO DA IMPORTAÇÃO:");
    console.log("=".repeat(50));
    console.log(`✅ Produtos inseridos: ${productsInserted}`);
    if (productsFailed > 0) console.log(`❌ Produtos falhados: ${productsFailed}`);
    console.log(`✅ Catálogo inserido: ${catalogInserted}`);
    if (catalogFailed > 0) console.log(`❌ Catálogo falhado: ${catalogFailed}`);
    console.log("=".repeat(50));
    console.log("✨ Importação concluída com sucesso!");
  } catch (err) {
    console.error(`❌ Erro fatal: ${err.message}`);
    process.exit(1);
  }
}

main();
