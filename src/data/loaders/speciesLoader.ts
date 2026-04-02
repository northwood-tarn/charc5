

import speciesCsv from "../csv/species.csv?raw";
import { parseCsv } from "./csvParser";

export interface SpeciesCsvRow {
  species_id: string;
  name: string;
  lineage_id: string;
  lineage_name: string;
  size?: string;
  speed?: string;
  senses?: string;
  resistances?: string;
  languages?: string;
}

export interface SpeciesOption {
  id: string;
  name: string;
}

export interface LineageOption {
  id: string;
  name: string;
  speciesId: string;
}

export interface NormalizedLineage {
  id: string;
  name: string;
  speciesId: string;
  speciesName: string;
  size: string | null;
  speed: number | null;
  senses: string[];
  resistances: string[];
  languages: string[];
}

export interface NormalizedSpecies {
  id: string;
  name: string;
  size: string | null;
  speed: number | null;
  senses: string[];
  resistances: string[];
  languages: string[];
  lineages: NormalizedLineage[];
}

const rows = parseCsv<SpeciesCsvRow>(speciesCsv);

function splitPipeList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseSpeed(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLineageRow(row: SpeciesCsvRow): NormalizedLineage {
  return {
    id: row.lineage_id,
    name: row.lineage_name,
    speciesId: row.species_id,
    speciesName: row.name,
    size: row.size?.trim() || null,
    speed: parseSpeed(row.speed),
    senses: splitPipeList(row.senses),
    resistances: splitPipeList(row.resistances),
    languages: splitPipeList(row.languages),
  };
}

function groupSpecies(rowsToGroup: SpeciesCsvRow[]): NormalizedSpecies[] {
  const grouped = new Map<string, NormalizedSpecies>();

  rowsToGroup.forEach((row) => {
    const lineage = normalizeLineageRow(row);
    const existing = grouped.get(row.species_id);

    if (!existing) {
      grouped.set(row.species_id, {
        id: row.species_id,
        name: row.name,
        size: lineage.size,
        speed: lineage.speed,
        senses: [...lineage.senses],
        resistances: [...lineage.resistances],
        languages: [...lineage.languages],
        lineages: [lineage],
      });
      return;
    }

    existing.lineages.push(lineage);

    if (!existing.size && lineage.size) {
      existing.size = lineage.size;
    }

    if (existing.speed === null && lineage.speed !== null) {
      existing.speed = lineage.speed;
    }

    if (existing.senses.length === 0 && lineage.senses.length > 0) {
      existing.senses = [...lineage.senses];
    }

    if (existing.resistances.length === 0 && lineage.resistances.length > 0) {
      existing.resistances = [...lineage.resistances];
    }

    if (existing.languages.length === 0 && lineage.languages.length > 0) {
      existing.languages = [...lineage.languages];
    }
  });

  return Array.from(grouped.values());
}

const normalizedSpecies = groupSpecies(rows);
const lineageIndex = new Map<string, NormalizedLineage>();

normalizedSpecies.forEach((species) => {
  species.lineages.forEach((lineage) => {
    lineageIndex.set(`${species.id}:${lineage.id}`, lineage);
  });
});

export function getSpecies(): NormalizedSpecies[] {
  return normalizedSpecies;
}

export function getSpeciesOptions(): SpeciesOption[] {
  return normalizedSpecies.map((species) => ({
    id: species.id,
    name: species.name,
  }));
}

export function getSpeciesById(speciesId: string | null | undefined): NormalizedSpecies | null {
  if (!speciesId) {
    return null;
  }

  return normalizedSpecies.find((species) => species.id === speciesId) ?? null;
}

export function getLineageOptionsForSpecies(speciesId: string | null | undefined): LineageOption[] {
  const species = getSpeciesById(speciesId);
  if (!species) {
    return [];
  }

  return species.lineages.map((lineage) => ({
    id: lineage.id,
    name: lineage.name,
    speciesId: lineage.speciesId,
  }));
}

export function getLineageById(
  speciesId: string | null | undefined,
  lineageId: string | null | undefined
): NormalizedLineage | null {
  if (!speciesId || !lineageId) {
    return null;
  }

  return lineageIndex.get(`${speciesId}:${lineageId}`) ?? null;
}