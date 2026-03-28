import type { Locality } from "@/lib/data";

export const LOCALITY_COLORS: Record<Locality, { bg: string; text: string; dot: string; border: string }> = {
  "Own Produce": { bg: "#d1e7c4", text: "#2d5016", dot: "#5a7a3d", border: "#a8c99a" },
  "Local":       { bg: "#dfe8d0", text: "#4a5c38", dot: "#6b7f52", border: "#b8c9a4" },
  "Regional":    { bg: "#e8ecd8", text: "#5c6648", dot: "#8E9F68", border: "#c8d1b8" },
  "UK":          { bg: "#f5f0e8", text: "#6b5d4a", dot: "#9b8a70", border: "#d9cfc0" },
  "International": { bg: "#ffe8d6", text: "#8b4513", dot: "#FF9310", border: "#ffc896" },
};
