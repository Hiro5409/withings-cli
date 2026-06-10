import colors from "yoctocolors";

export type OutputFormat = "json" | "table";

export function outputFormat(value: unknown): OutputFormat {
  return value === "json" ? "json" : "table";
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printRows(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    console.log(colors.dim("No rows."));
    return;
  }

  const headers = Object.keys(rows[0] ?? {});
  const widths = headers.map((header) =>
    Math.max(header.length, ...rows.map((row) => String(row[header] ?? "").length)),
  );

  console.log(headers.map((header, index) => header.padEnd(widths[index] ?? 0)).join("  "));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) {
    console.log(
      headers
        .map((header, index) => String(row[header] ?? "").padEnd(widths[index] ?? 0))
        .join("  "),
    );
  }
}

export function printMessage(message: string, format: OutputFormat, payload: unknown): void {
  if (format === "json") printJson(payload);
  else console.log(message);
}
