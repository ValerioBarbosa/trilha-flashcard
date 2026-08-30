export function MetricTile({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return <div className="metric-tile"><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>;
}
