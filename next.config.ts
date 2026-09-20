import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite que el server de pruebas (npm run dev:test) use su propia
  // carpeta de build en vez de compartir .next con el dev server normal —
  // dos "next dev" escribiendo el mismo .next en paralelo lo corrompe.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
