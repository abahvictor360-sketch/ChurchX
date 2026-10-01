export type ValueFormat = { kind: "number" } | { kind: "money"; currency: string };

export function fmt(value: number, f: ValueFormat = { kind: "number" }, compact = false) {
  if (f.kind === "money") {
    try {
      return new Intl.NumberFormat("en", {
        style: "currency",
        currency: f.currency,
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : 0,
      }).format(value);
    } catch {
      return `${f.currency} ${value.toLocaleString()}`;
    }
  }
  return new Intl.NumberFormat("en", { notation: compact ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}
