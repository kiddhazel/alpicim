/** Küçük skor kutusu . */
export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-20 rounded-lg bg-control px-3 py-1.5 text-center">
      <div className="text-xs  text-fg-2">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-fg">{value}</div>
    </div>
  );
}
