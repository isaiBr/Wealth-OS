import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wealth OS",
    short_name: "Wealth OS",
    description: "Finanzas personales automatizadas",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6ef",
    theme_color: "#0b5c42",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
