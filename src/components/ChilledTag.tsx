// Shared visual for refrigerated / chilled products.
// Use <ChilledTag /> for the inline badge and `chilledRowClass` / `chilledCellClass`
// to tint a row or cell light blue. Keep this the single source of the look so
// "chilled" is identical across the supplier portal and admin.

export const chilledRowClass = "bg-sky-50";
export const chilledCellClass = "bg-sky-100";

export function ChilledTag({ className = "" }: { className?: string }) {
  return (
    <span
      title="Refrigerated - keep chilled"
      className={`inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700 ${className}`}
    >
      <span aria-hidden>❄</span> F
    </span>
  );
}
