import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MsgBuddy",
    short_name: "MsgBuddy",
    description: "Multi-tenant WhatsApp SaaS platform",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0f0f15",
    theme_color: "#0f0f15",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/square.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
