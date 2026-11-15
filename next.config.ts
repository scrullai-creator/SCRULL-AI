import type { NextConfig } from "next";

const config: NextConfig = {
  // O upload da logo passa por uma server action: permite até 4 MB (logo e fotos)
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // As fontes usadas para escrever o título nas artes precisam ir junto no deploy
  outputFileTracingIncludes: { "/painel": ["./lib/fontes/**/*"], "/api/**/*": ["./lib/fontes/**/*"] },
};

export default config;
