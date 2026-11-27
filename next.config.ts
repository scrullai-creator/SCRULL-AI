import type { NextConfig } from "next";

const config: NextConfig = {
  // O upload da logo passa por uma server action: permite até 4 MB (logo e fotos)
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // As fontes usadas para escrever o título nas artes precisam ir junto no deploy
  outputFileTracingIncludes: { "/painel": ["./lib/fontes/**/*"], "/api/**/*": ["./lib/fontes/**/*"] },
  // Cabeçalhos de segurança em todas as páginas: impede que o app seja aberto dentro de outro site
  // (golpe de clique escondido), força HTTPS e não vaza o endereço completo para outros sites.
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default config;
