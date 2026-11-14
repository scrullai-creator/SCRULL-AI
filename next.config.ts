import type { NextConfig } from "next";

const config: NextConfig = {
  // O upload da logo passa por uma server action: permite até 3 MB
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default config;
