export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "∞";
  const abs = Math.abs(value);
  if (abs < 1000) return String(value);
  if (abs < 1_000_000) {
    const scaled = value / 1000;
    return `${Number.isInteger(scaled) ? scaled : scaled.toFixed(1)}K`;
  }
  const scaled = value / 1_000_000;
  return `${Number.isInteger(scaled) ? scaled : scaled.toFixed(2)}M`;
}

export const formatExact = (value: number): string => value.toLocaleString("en-US");

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : pluralForm}`;
