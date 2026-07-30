// GA4 event helper - no-ops when gtag isn't loaded (admin/portal routes, ad blockers)
export function gaEvent(name: string, params: Record<string, unknown>) {
  if (typeof window !== "undefined" && "gtag" in window) {
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", name, params);
  }
}
