import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(body: Record<string, unknown>) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
}

/** Tenta identificar o produto pelo EAN usando Gemini (texto). */
export const aiLookupByBarcode = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ barcode: z.string().trim().min(4).max(32) }).parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const json = await callAI({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              'Você identifica produtos vendidos no Brasil pelo código de barras (EAN/GTIN). Responda APENAS um JSON no formato {"name": string|null}. Se não tiver alta confiança, retorne {"name": null}. NUNCA invente nome de produto.',
          },
          {
            role: "user",
            content: `Qual o nome comercial completo (marca + produto + variante/sabor + peso/volume) do produto com EAN ${data.barcode}? Responda só o JSON.`,
          },
        ],
        response_format: { type: "json_object" },
      });
      const raw = json.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as { name?: unknown };
      const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
      return { name: name && name.length > 1 ? name : null };
    } catch (err) {
      console.error("[aiLookupByBarcode]", err);
      return { name: null as string | null };
    }
  });

/** Lê o rótulo da foto e devolve o nome comercial (último recurso). */
export const aiVisionReadLabel = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        imageDataUrl: z
          .string()
          .startsWith("data:image/")
          .max(2_500_000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const json = await callAI({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você lê rótulos de embalagens de produtos. Retorne SOMENTE o nome comercial exato visível na embalagem (marca + nome + variante/sabor + peso/volume, quando visíveis). Se a imagem estiver ilegível, cortada ou não for uma embalagem, responda exatamente: ilegível. Não invente informações.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Leia o rótulo desta embalagem e retorne só o nome comercial do produto.",
              },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      });
      const text = (json.choices?.[0]?.message?.content ?? "").trim();
      if (!text || /^ileg[íi]vel/i.test(text)) return { name: null as string | null };
      // Sanitize: keep first line, remove surrounding quotes.
      const first = text.split("\n")[0].replace(/^["'`]+|["'`]+$/g, "").trim();
      return { name: first || null };
    } catch (err) {
      console.error("[aiVisionReadLabel]", err);
      return { name: null as string | null };
    }
  });
