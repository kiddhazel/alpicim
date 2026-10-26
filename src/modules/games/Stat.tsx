/** Küçük skor kutusu (piksel/arcade görünümlü). */
export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass min-w-20 rounded-xl px-3 py-1.5 text-center">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="font-mono text-lg font-bold tabular-nums text-fg">{value}</div>
    </div>
  );
}
