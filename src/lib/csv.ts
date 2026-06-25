export function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function timestampForFile(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(
    date.getMinutes()
  )}-${pad(date.getSeconds())}`;
}
