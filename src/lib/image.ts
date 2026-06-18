// Resize an image File/Blob/URL to a compact JPEG data URL for storage in DB.
export async function compressImageToDataUrl(
  source: File | Blob | string,
  maxDim = 800,
  quality = 0.78,
): Promise<string> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function fetchOpenFoodFacts(barcode: string): Promise<{
  name?: string;
  imageUrl?: string;
  found: boolean;
}> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
    );
    const json = await res.json();
    if (json.status === 1 && json.product) {
      const p = json.product;
      return {
        found: true,
        name: p.product_name_pt || p.product_name || p.generic_name || undefined,
        imageUrl: p.image_front_url || p.image_url || undefined,
      };
    }
    return { found: false };
  } catch {
    return { found: false };
  }
}
