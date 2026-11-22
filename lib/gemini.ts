// Gerador de imagens PRINCIPAL: Nano Banana 2.1 (Google, API do Gemini).
// Se a chave não estiver configurada, se o Google der erro ou demorar demais, devolve null
// e quem chamou segue com o GPT (OpenAI), que fica como reserva automática.
import sharp from "sharp";

const MODELO = process.env.GEMINI_IMAGE_MODEL ?? "gemini-nano-banana-2.1";
const TAMANHO = process.env.GEMINI_IMAGE_SIZE ?? "1K"; // 1K | 2K | 4K (o app trabalha em 1024x1024)
const TEMPO_LIMITE = Number(process.env.GEMINI_TIMEOUT_MS ?? 45_000);

export const geminiLigado = () => !!process.env.GEMINI_API_KEY && process.env.GERADOR_IMAGEM !== "openai";

async function tipoDa(b: Buffer) {
  const f = (await sharp(b).metadata().catch(() => null))?.format;
  return f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
}

export async function gerarComGemini(prompt: string, referencias: Buffer[] = []): Promise<Buffer | null> {
  if (!geminiLigado()) return null;
  try {
    const partes: any[] = [{ text: prompt }];
    for (const r of referencias.slice(0, 3)) {
      partes.push({ inline_data: { mime_type: await tipoDa(r), data: r.toString("base64") } });
    }
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: partes }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1", imageSize: TAMANHO } },
      }),
      signal: AbortSignal.timeout(TEMPO_LIMITE),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("[gemini] erro", res.status, j?.error?.message ?? "", "— usando o GPT");
      return null;
    }
    const img = (j?.candidates?.[0]?.content?.parts ?? []).filter((p: any) => p.inlineData?.data || p.inline_data?.data).pop();
    const b64 = img?.inlineData?.data ?? img?.inline_data?.data;
    if (!b64) {
      console.error("[gemini] não devolveu imagem", j?.candidates?.[0]?.finishReason ?? j?.promptFeedback?.blockReason ?? "", "— usando o GPT");
      return null;
    }
    if (j.usageMetadata) console.log("[gemini] uso:", JSON.stringify(j.usageMetadata));
    // O resto do app espera 1024x1024 em JPEG
    return await sharp(Buffer.from(b64, "base64")).resize(1024, 1024, { fit: "cover" }).jpeg({ quality: 92 }).toBuffer();
  } catch (e: any) {
    console.error("[gemini] falhou:", e?.message, "— usando o GPT");
    return null;
  }
}
