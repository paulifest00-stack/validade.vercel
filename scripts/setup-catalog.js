import { createClient } from "@supabase/supabase-js";

// Configuração do Supabase
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Erro: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão definidas.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Cria a tabela product_catalog
 */
async function createCatalogTable() {
  console.log("📚 Criando tabela product_catalog...");

  try {
    // Tenta criar a tabela
    const { data, error } = await supabase.rpc("exec", {
      sql: `
        CREATE TABLE IF NOT EXISTS public.product_catalog (
          barcode TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          photo_url TEXT NULL,
          created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );

        ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

        CREATE POLICY IF NOT EXISTS "Public product_catalog is viewable by everyone." 
          ON public.product_catalog FOR SELECT USING (TRUE);

        CREATE POLICY IF NOT EXISTS "Users can insert their own product_catalog." 
          ON public.product_catalog FOR INSERT WITH CHECK (TRUE);

        CREATE POLICY IF NOT EXISTS "Users can update their own product_catalog." 
          ON public.product_catalog FOR UPDATE USING (TRUE);

        CREATE POLICY IF NOT EXISTS "Users can delete their own product_catalog." 
          ON public.product_catalog FOR DELETE USING (TRUE);
      `,
    });

    if (error) {
      console.error("❌ Erro ao criar tabela:", error);
      return false;
    }

    console.log("✅ Tabela product_catalog criada com sucesso!");
    return true;
  } catch (err) {
    console.error("❌ Erro:", err.message);
    return false;
  }
}

/**
 * Popula o catálogo com dados dos produtos existentes
 */
async function populateCatalogFromProducts() {
  console.log("📦 Buscando produtos com barcode válido...");

  try {
    // Busca todos os produtos com barcode
    const { data: products, error: fetchError } = await supabase
      .from("products")
      .select("barcode, name")
      .not("barcode", "is", null)
      .order("barcode", { ascending: true });

    if (fetchError) {
      console.error("❌ Erro ao buscar produtos:", fetchError);
      return 0;
    }

    if (!products || products.length === 0) {
      console.log("ℹ️  Nenhum produto com barcode encontrado.");
      return 0;
    }

    console.log(`📚 Populando catálogo com ${products.length} produtos...`);

    // Remove duplicatas (mantém apenas o primeiro de cada barcode)
    const uniqueByBarcode = new Map();
    for (const product of products) {
      if (!uniqueByBarcode.has(product.barcode)) {
        uniqueByBarcode.set(product.barcode, {
          barcode: product.barcode,
          name: product.name,
          photo_url: null,
        });
      }
    }

    const catalogEntries = Array.from(uniqueByBarcode.values());
    console.log(`📝 ${catalogEntries.length} entradas únicas para inserir...`);

    // Insere em lote
    const batchSize = 50;
    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < catalogEntries.length; i += batchSize) {
      const batch = catalogEntries.slice(i, i + batchSize);

      const { error: upsertError } = await supabase
        .from("product_catalog")
        .upsert(batch, { onConflict: "barcode" });

      if (upsertError) {
        console.error(
          `❌ Erro ao inserir lote ${Math.floor(i / batchSize) + 1}: ${upsertError.message}`,
        );
        failed += batch.length;
      } else {
        inserted += batch.length;
        console.log(
          `✅ Lote ${Math.floor(i / batchSize) + 1} inserido (${inserted}/${catalogEntries.length})`,
        );
      }
    }

    return inserted;
  } catch (err) {
    console.error("❌ Erro:", err.message);
    return 0;
  }
}

/**
 * Função principal
 */
async function main() {
  console.log("🚀 Configurando catálogo de produtos...\n");

  // Tenta criar a tabela (pode falhar se já existe, mas tudo bem)
  await createCatalogTable();

  console.log();

  // Popula o catálogo
  const inserted = await populateCatalogFromProducts();

  console.log("\n" + "=".repeat(50));
  console.log("📊 RESUMO:");
  console.log("=".repeat(50));
  console.log(`✅ Entradas do catálogo inseridas: ${inserted}`);
  console.log("=".repeat(50));
  console.log("✨ Configuração concluída!");
}

main();
