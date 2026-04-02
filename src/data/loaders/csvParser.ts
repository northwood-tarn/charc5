export type CsvRecord = Record<string, string>;

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }

      currentRow.push(currentCell);
      const hasMeaningfulContent = currentRow.some((cell) => cell.trim().length > 0);
      if (hasMeaningfulContent) {
        rows.push(currentRow);
      }

      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  const hasTrailingContent = currentRow.some((cell) => cell.trim().length > 0);
  if (hasTrailingContent) {
    rows.push(currentRow);
  }

  return rows;
}

export function splitCsvLine(line: string): string[] {
  return parseCsvRows(line)[0] ?? [];
}

export function parseCsv<T = CsvRecord>(csvText: string): T[] {
  const rows = parseCsvRows(csvText);

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((row) => {
    const record: CsvRecord = {};

    headers.forEach((header, index) => {
      record[header] = (row[index] ?? "").trim();
    });

    return record as T;
  });
}