export function formatMoney(cents: number | null | undefined): string {
  if (typeof cents !== "number") return "—";
  return `${(cents / 100).toLocaleString("en-RW", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} RWF`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-RW", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function humanizeState(state: string): string {
  return state.toLowerCase().replace(/_/g, " ");
}

export function formatPhone(phone?: string | null): string {
  if (!phone) return "—";
  return phone.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3");
}

export function pluralize(
  n: number,
  singular: string,
  plural?: string,
): string {
  return `${n} ${n === 1 ? singular : (plural ?? `${singular}s`)}`;
}
