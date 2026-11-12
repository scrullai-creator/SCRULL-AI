// Cifra os tokens do Instagram antes de guardar no banco (AES-256-GCM).
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function chave() {
  const k = process.env.ENCRYPTION_KEY ?? "";
  if (Buffer.byteLength(k, "utf8") !== 32) {
    throw new Error("ENCRYPTION_KEY precisa ter exatamente 32 caracteres");
  }
  return Buffer.from(k, "utf8");
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), dados].map((b) => b.toString("base64")).join(".");
}

export function decifrar(valor: string): string {
  const [iv, tag, dados] = valor.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString("utf8");
}
