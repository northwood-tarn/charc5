export type ParsedToolRow = {
  tool_id: string;
  tool_name: string;
  tool_type?: string;
};

export function parseToolsCsv(raw: string): ParsedToolRow[] {
  const lines = raw
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  return lines.slice(1).map((line) => {
    const [tool_id, tool_name, tool_type] = line.split(",");
    return {
      tool_id: (tool_id ?? "").trim(),
      tool_name: (tool_name ?? "").trim(),
      tool_type: (tool_type ?? "").trim(),
    };
  });
}
