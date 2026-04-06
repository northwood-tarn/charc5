import toolsCsv from "../csv/tools.csv?raw";
import { parseCsv } from "./csvParser";

export interface ToolRow {
  tool_id: string;
  tool_name: string;
  tool_type?: string;
}

export interface NormalizedTool {
  id: string;
  name: string;
  type: string | null;
}

export interface ToolOption {
  id: string;
  name: string;
}

const toolRows = parseCsv<ToolRow>(toolsCsv);

function normalizeTool(row: ToolRow): NormalizedTool {
  return {
    id: row.tool_id,
    name: row.tool_name,
    type: row.tool_type?.trim().toLowerCase() || null,
  };
}

const normalizedTools = toolRows.map(normalizeTool);

function normalizeTypeKey(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[-\s]+/g, "_");

  return normalized.length > 0 ? normalized : null;
}

export function getTools(): NormalizedTool[] {
  return normalizedTools;
}

export function getToolOptions(): ToolOption[] {
  return normalizedTools.map((tool) => ({
    id: tool.id,
    name: tool.name,
  }));
}

export function getToolsByType(type: string | null | undefined): NormalizedTool[] {
  const normalizedType = normalizeTypeKey(type);

  if (!normalizedType) {
    return [];
  }

  return normalizedTools.filter((tool) => normalizeTypeKey(tool.type) === normalizedType);
}

export function getToolOptionsByType(type: string | null | undefined): ToolOption[] {
  return getToolsByType(type).map((tool) => ({
    id: tool.id,
    name: tool.name,
  }));
}

export function getInstrumentOptions(): ToolOption[] {
  return getToolOptionsByType("instrument");
}

export function getToolById(toolId: string | null | undefined): NormalizedTool | null {
  if (!toolId) {
    return null;
  }

  return normalizedTools.find((tool) => tool.id === toolId) ?? null;
}
