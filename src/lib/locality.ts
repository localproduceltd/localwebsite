import type { Locality } from "@/lib/data";

export const LOCALITY_COLORS: Record<Locality, { bg: string; text: string; dot: string; border: string }> = {
  "Own Produce": { bg: "#dcfce7", text: "#166534", dot: "#22c55e", border: "#bbf7d0" },
  "Local":       { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6", border: "#bfdbfe" },
  "Regional":    { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b", border: "#fde68a" },
  "UK":          { bg: "#f3e8ff", text: "#6b21a8", dot: "#a855f7", border: "#e9d5ff" },
  "International": { bg: "#ffe4e6", text: "#9f1239", dot: "#f43f5e", border: "#fecdd3" },
};
