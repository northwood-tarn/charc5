import spellProgressionCsv from "../data/csv/spellProgression.csv?raw";
import { getClassFeatureFile } from "../data/classFeatures/classFeatureRegistry";
import { getClasses } from "../data/loaders/classLoader";
import { parseCsv } from "../data/loaders/csvParser";
import { getSpells, type SpellRecord } from "../data/loaders/spellsLoader";
import type { CharacterDraft } from "../types/draft";
import type { ResolvedCharacterSheet } from "../types/sheet";
import { resolveSpellRepertoire } from "./spellRepertoireResolver";

interface SpellProgressionRow {
  class: string;
  class_id: string;
  subclass: string;
  subclass_id: string;
  level: string;
  max_spell_level: string;
  slot_1: string;
  slot_2: string;
  slot_3: string;
  slot_4: string;
  slot_5: string;
  slot_6: string;
  slot_7: string;
  slot_8: string;
  slot_9: string;
  pact_slot_level: string;
  pact_slots: string;
}

type JsonFeatureOption = {
  id: string;
  label: string;
  derivedEffects?: unknown;
  derived_effects?: unknown;
  effects?: unknown;
};

type JsonFeatureChoice = {
  kind?: string | null;
  count?: number | null;
  pool?: string[] | string | null;
  options?: JsonFeatureOption[];
};

type JsonResourceScalingRow = {
  level: number;
  value: string;
};

type JsonFeatureResourceEntry = {
  resource_id?: string;
  resource_name?: string;
  scaling?: JsonResourceScalingRow[];
};

type JsonFeatureResource = {
  kind?: string;
  resources?: JsonFeatureResourceEntry[];
};

type JsonFeatureRecord = {
  featureId?: string;
  featureName?: string;
  id?: string;
  name?: string;
  level: number;
  description: string;
  subclassId?: string;
  subclassName?: string;
  sourceType?: "class";
  sourceId?: string;
  sourceName?: string;
  derivedEffects?: unknown;
  derived_effects?: unknown;
  effects?: unknown;
  resource?: JsonFeatureResource;
  selectionKey?: string | null;
  choiceKind?: string | null;
  choiceCount?: number | null;
  choicePool?: string[] | null;
  choiceOptions?: JsonFeatureOption[];
  choice?: JsonFeatureChoice;
};

type JsonClassFeatureFile = {
  classId?: string;
  className?: string;
  class_id?: string;
  class_name?: string;
  features: JsonFeatureRecord[];
  subclasses?: Record<string, { features: JsonFeatureRecord[] }>;
};

export type SpellSelectionBucket = "known" | "prepared" | "granted";
export type SpellSelectionKind = "fixed" | "selectable";

export interface SpellSelectionOption {
  spellId: string;
  spellName: string;
  spellLevel: number;
  school: string;
  classNames: string[];
}

export interface SpellSelectionSlot {
  slotId: string;
  sourceType: "class" | "feature";
  sourceId: string;
  sourceName: string;
  bucket: SpellSelectionBucket;
  kind: SpellSelectionKind;
  countsAgainstLimit: boolean;
  isAlwaysPrepared: boolean;
  fixedSpellId: string | null;
  selectedSpellId: string | null;
  allowedSpellLevels: number[];
  allowedSchools: string[];
  allowedSpellIds: string[];
  options: SpellSelectionOption[];
}

export interface SpellSelectionState {
  classId: string | null;
  subclassId: string | null;
  className: string;
  subclassName: string;
  maxSpellLevel: number | null;
  knownSpellSlots: SpellSelectionSlot[];
  preparedSpellSlots: SpellSelectionSlot[];
  grantedSpellSlots: SpellSelectionSlot[];
  allAvailableSpells: SpellSelectionOption[];
}

const spellProgressionRows = parseCsv<SpellProgressionRow>(spellProgressionCsv);
const classOptions = getClasses();
const spellRecords = getSpells();

function parseNullableNumber(value: string | null | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSpellId(value: string): string {
  return value.trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function uniqueSpellOptions(options: SpellSelectionOption[]): SpellSelectionOption[] {
  const byId = new Map<string, SpellSelectionOption>();

  for (const option of options) {
    if (!byId.has(option.spellId)) {
      byId.set(option.spellId, option);
    }
  }

  return Array.from(byId.values());
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function getClassName(classId: string | null): string {
  if (!classId) return "";
  return classOptions.find((option) => option.id === classId)?.name ?? classId;
}

function getEffectiveSpellListClassName(draft: CharacterDraft): string {
  if (draft.classId === "fighter" && draft.subclassId === "eldritch_knight") {
    return "wizard";
  }

  if (draft.classId === "rogue" && draft.subclassId === "arcane_trickster") {
    return "wizard";
  }

  return normalizeText(getClassName(draft.classId));
}

function getSpellProgressionRow(draft: CharacterDraft): SpellProgressionRow | null {
  if (!draft.classId || draft.level === null) {
    return null;
  }

  const subclassRow = spellProgressionRows.find((row) => {
    const rowLevel = parseNullableNumber(row.level);
    return (
      row.class_id === draft.classId &&
      row.subclass_id === (draft.subclassId ?? "") &&
      rowLevel === draft.level
    );
  });

  if (subclassRow) {
    return subclassRow;
  }

  return (
    spellProgressionRows.find((row) => {
      const rowLevel = parseNullableNumber(row.level);
      return (
        row.class_id === draft.classId &&
        !row.subclass_id &&
        rowLevel === draft.level
      );
    }) ?? null
  );
}

function getMaxSpellLevelFromProgression(draft: CharacterDraft): number | null {
  return parseNullableNumber(getSpellProgressionRow(draft)?.max_spell_level);
}

function toSelectionOption(spell: SpellRecord): SpellSelectionOption {
  return {
    spellId: spell.id,
    spellName: spell.name,
    spellLevel: spell.level,
    school: spell.school,
    classNames: Array.isArray(spell.classes) ? [...spell.classes] : [],
  };
}

function getCantripOptions(draft: CharacterDraft): SpellSelectionOption[] {
  if (!draft.classId) return [];
  const className = getEffectiveSpellListClassName(draft);

  return spellRecords
    .filter(
      (spell) =>
        spell.level === 0 &&
        spell.classes.some((entry) => normalizeText(entry) === className)
    )
    .map(toSelectionOption)
    .sort((a, b) => a.spellName.localeCompare(b.spellName));
}

function getLeveledSpellOptions(
  draft: CharacterDraft,
  maxSpellLevel: number | null
): SpellSelectionOption[] {
  if (!draft.classId) return [];
  const className = getEffectiveSpellListClassName(draft);

  return spellRecords
    .filter((spell) => {
      if (spell.level <= 0) return false;
      if (maxSpellLevel !== null && spell.level > maxSpellLevel) return false;
      return spell.classes.some((entry) => normalizeText(entry) === className);
    })
    .map(toSelectionOption)
    .sort((a, b) => {
      if (a.spellLevel !== b.spellLevel) {
        return a.spellLevel - b.spellLevel;
      }
      return a.spellName.localeCompare(b.spellName);
    });
}

function getAllClassSpellOptions(
  draft: CharacterDraft,
  maxSpellLevel: number | null
): SpellSelectionOption[] {
  return uniqueSpellOptions([
    ...getCantripOptions(draft),
    ...getLeveledSpellOptions(draft, maxSpellLevel),
  ]).sort((a, b) => {
    if (a.spellLevel !== b.spellLevel) {
      return a.spellLevel - b.spellLevel;
    }
    return a.spellName.localeCompare(b.spellName);
  });
}

function buildGenericSlot(args: {
  slotId: string;
  sourceType: "class" | "feature";
  sourceId: string;
  sourceName: string;
  bucket: SpellSelectionBucket;
  countsAgainstLimit: boolean;
  isAlwaysPrepared: boolean;
  fixedSpellId?: string | null;
  selectedSpellId?: string | null;
  allowedSpellLevels: number[];
  allowedSchools?: string[];
  allowedSpellIds?: string[];
  options: SpellSelectionOption[];
}): SpellSelectionSlot {
  return {
    slotId: args.slotId,
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    sourceName: args.sourceName,
    bucket: args.bucket,
    kind: args.fixedSpellId ? "fixed" : "selectable",
    countsAgainstLimit: args.countsAgainstLimit,
    isAlwaysPrepared: args.isAlwaysPrepared,
    fixedSpellId: args.fixedSpellId ?? null,
    selectedSpellId: args.selectedSpellId ?? null,
    allowedSpellLevels: args.allowedSpellLevels,
    allowedSchools: uniqueStrings(args.allowedSchools ?? []),
    allowedSpellIds: uniqueStrings(args.allowedSpellIds ?? []),
    options: uniqueSpellOptions(args.options),
  };
}

function filterOptionsForConstraints(args: {
  options: SpellSelectionOption[];
  allowedSpellLevels?: number[];
  allowedSchools?: string[];
  allowedSpellIds?: string[];
}): SpellSelectionOption[] {
  const allowedSpellLevels = args.allowedSpellLevels ?? [];
  const allowedSchools = uniqueStrings(args.allowedSchools ?? []);
  const allowedSpellIds = uniqueStrings(args.allowedSpellIds ?? []);

  return args.options.filter((option) => {
    if (allowedSpellLevels.length > 0 && !allowedSpellLevels.includes(option.spellLevel)) {
      return false;
    }
    if (
      allowedSchools.length > 0 &&
      !allowedSchools.includes(normalizeText(option.school))
    ) {
      return false;
    }
    if (allowedSpellIds.length > 0 && !allowedSpellIds.includes(option.spellId)) {
      return false;
    }
    return true;
  });
}

function getFeatureSourceId(
  feature: JsonFeatureRecord,
  featureFile: JsonClassFeatureFile,
  subclassIdOverride?: string
): string {
  return (
    feature.sourceId ??
    feature.subclassId ??
    subclassIdOverride ??
    featureFile.classId ??
    featureFile.class_id ??
    ""
  );
}

function getFeatureSourceName(
  feature: JsonFeatureRecord,
  featureFile: JsonClassFeatureFile,
  subclassNameOverride?: string
): string {
  return (
    feature.sourceName ??
    feature.subclassName ??
    subclassNameOverride ??
    featureFile.className ??
    featureFile.class_name ??
    ""
  );
}

function getFeatureName(feature: JsonFeatureRecord): string {
  return feature.featureName ?? feature.name ?? feature.id ?? "";
}

function extractSpellGrantEntries(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const directSpellGrants =
    record.spell_grants ??
    record.spellGrants ??
    record.spell_grant ??
    record.spellGrant;
  const nestedEffects =
    record.effects && typeof record.effects === "object"
      ? (record.effects as Record<string, unknown>)
      : null;
  const spellGrants = Array.isArray(directSpellGrants)
    ? directSpellGrants
    : Array.isArray(nestedEffects?.spell_grants)
      ? nestedEffects.spell_grants
      : Array.isArray(nestedEffects?.spellGrants)
        ? nestedEffects.spellGrants
        : Array.isArray(nestedEffects?.spell_grant)
          ? nestedEffects.spell_grant
          : Array.isArray(nestedEffects?.spellGrant)
            ? nestedEffects.spellGrant
            : null;

  if (!Array.isArray(spellGrants)) {
    return [];
  }

  return spellGrants.filter(
    (entry): entry is Record<string, unknown> => !!entry && typeof entry === "object"
  );
}

function extractSpellSelectionEntries(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const directEntries =
    record.spell_selection_slots ??
    record.spellSelectionSlots ??
    record.spell_selections ??
    record.spellSelections ??
    record.spell_slots ??
    record.spellSlots ??
    record.known_spell_slots ??
    record.knownSpellSlots ??
    record.spellbook_slots ??
    record.spellbookSlots ??
    record.cantrip_slots ??
    record.cantripSlots ??
    record.cantrip_selections ??
    record.cantripSelections ??
    record.spells_known_slots ??
    record.spellsKnownSlots;

  const nestedEffects =
    record.effects && typeof record.effects === "object"
      ? (record.effects as Record<string, unknown>)
      : null;

  const entries = Array.isArray(directEntries)
    ? directEntries
    : Array.isArray(nestedEffects?.spell_selection_slots)
      ? nestedEffects.spell_selection_slots
      : Array.isArray(nestedEffects?.spellSelectionSlots)
        ? nestedEffects.spellSelectionSlots
        : Array.isArray(nestedEffects?.spell_selections)
          ? nestedEffects.spell_selections
          : Array.isArray(nestedEffects?.spellSelections)
            ? nestedEffects.spellSelections
            : Array.isArray(nestedEffects?.spell_slots)
              ? nestedEffects.spell_slots
              : Array.isArray(nestedEffects?.spellSlots)
                ? nestedEffects.spellSlots
                : Array.isArray(nestedEffects?.known_spell_slots)
                  ? nestedEffects.known_spell_slots
                  : Array.isArray(nestedEffects?.knownSpellSlots)
                    ? nestedEffects.knownSpellSlots
                    : Array.isArray(nestedEffects?.spellbook_slots)
                      ? nestedEffects.spellbook_slots
                      : Array.isArray(nestedEffects?.spellbookSlots)
                        ? nestedEffects.spellbookSlots
                        : Array.isArray(nestedEffects?.cantrip_slots)
                          ? nestedEffects.cantrip_slots
                          : Array.isArray(nestedEffects?.cantripSlots)
                            ? nestedEffects.cantripSlots
                            : Array.isArray(nestedEffects?.cantrip_selections)
                              ? nestedEffects.cantrip_selections
                              : Array.isArray(nestedEffects?.cantripSelections)
                                ? nestedEffects.cantripSelections
                                : Array.isArray(nestedEffects?.spells_known_slots)
                                  ? nestedEffects.spells_known_slots
                                  : Array.isArray(nestedEffects?.spellsKnownSlots)
                                    ? nestedEffects.spellsKnownSlots
                                    : null;

  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.filter(
    (entry): entry is Record<string, unknown> => !!entry && typeof entry === "object"
  );
}

function extractSpellIds(record: Record<string, unknown>): string[] {
  return uniqueStrings([
    ...asStringArray(record.spells),
    ...asStringArray(record.spell_ids),
    ...asStringArray(record.spellIds),
  ].map(normalizeSpellId));
}

function extractAllowedSchools(record: Record<string, unknown>): string[] {
  return uniqueStrings([
    ...asStringArray(record.schools),
    ...asStringArray(record.school_ids),
    ...asStringArray(record.schoolIds),
    ...(typeof record.school === "string" ? [record.school] : []),
  ].map(normalizeText));
}

function extractAllowedSpellLevels(
  record: Record<string, unknown>,
  fallbackMaxSpellLevel: number | null
): number[] {
  const rawValues = [
    ...asStringArray(record.levels),
    ...asStringArray(record.spell_levels),
    ...asStringArray(record.spellLevels),
    ...(typeof record.level === "number" || typeof record.level === "string"
      ? [String(record.level)]
      : []),
    ...(typeof record.spell_level === "number" || typeof record.spell_level === "string"
      ? [String(record.spell_level)]
      : []),
    ...(typeof record.spellLevel === "number" || typeof record.spellLevel === "string"
      ? [String(record.spellLevel)]
      : []),
  ];

  const parsed = uniqueStrings(rawValues)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (parsed.length > 0) {
    return parsed;
  }

  if (fallbackMaxSpellLevel !== null) {
    return Array.from({ length: fallbackMaxSpellLevel + 1 }, (_, index) => index).filter(
      (value) => value >= 0
    );
  }

  return [];
}

function extractCount(record: Record<string, unknown>, fallback = 1): number {
  const rawCount =
    typeof record.count === "number"
      ? record.count
      : typeof record.count === "string"
        ? Number(record.count)
        : fallback;

  if (!Number.isFinite(rawCount) || rawCount < 1) {
    return fallback;
  }

  return rawCount;
}

function isAlwaysPrepared(record: Record<string, unknown>): boolean {
  const kind = typeof record.kind === "string" ? normalizeText(record.kind) : "";
  return (
    record.always_prepared === true ||
    record.alwaysPrepared === true ||
    kind === "fixed"
  );
}

function countsAgainstLimit(record: Record<string, unknown>, fallback = true): boolean {
  if (record.counts_against_limit === true || record.countsAgainstLimit === true) {
    return true;
  }

  if (record.counts_against_limit === false || record.countsAgainstLimit === false) {
    return false;
  }

  return fallback;
}

function getScalingValueAtLevel(
  scaling: JsonResourceScalingRow[] | undefined,
  level: number | null
): string | null {
  if (!scaling || level === null) {
    return null;
  }

  const sorted = [...scaling].sort((a, b) => a.level - b.level);
  let current: string | null = null;

  for (const row of sorted) {
    if (row.level <= level) {
      current = row.value;
    } else {
      break;
    }
  }

  return current;
}

function getResourceCountForFeature(
  feature: JsonFeatureRecord,
  resourceId: string,
  level: number | null
): number {
  const resources = feature.resource?.resources ?? [];
  const match = resources.find((entry) => entry.resource_id === resourceId);
  const value = getScalingValueAtLevel(match?.scaling, level);

  if (!value) {
    return 0;
  }

  const parsed = Number(String(value).split("|")[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getPactSlotCountForFeature(
  feature: JsonFeatureRecord,
  level: number | null
): number {
  const resources = feature.resource?.resources ?? [];
  const match = resources.find(
    (entry) =>
      entry.resource_id === "spell_slots" &&
      normalizeText(entry.resource_name ?? "") === "pact slot"
  );
  const value = getScalingValueAtLevel(match?.scaling, level);

  if (!value) {
    return 0;
  }

  const parsed = Number(String(value).split("|")[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function gatherFeatureRecords(
  draft: CharacterDraft,
  featureFile: JsonClassFeatureFile | null
): Array<{
  feature: JsonFeatureRecord;
  sourceId: string;
  sourceName: string;
}> {
  if (!featureFile || draft.level === null) {
    return [];
  }

  const records: Array<{
    feature: JsonFeatureRecord;
    sourceId: string;
    sourceName: string;
  }> = [];

  for (const feature of featureFile.features ?? []) {
    if (feature.level > draft.level) continue;
    if (feature.subclassId && feature.subclassId !== draft.subclassId) continue;

    records.push({
      feature,
      sourceId: getFeatureSourceId(feature, featureFile),
      sourceName: getFeatureName(feature) || getFeatureSourceName(feature, featureFile),
    });
  }

  const subclasses = featureFile.subclasses ?? {};
  for (const [subclassId, subclassBlock] of Object.entries(subclasses)) {
    if (subclassId !== (draft.subclassId ?? "")) continue;

    for (const feature of subclassBlock.features ?? []) {
      if (feature.level > draft.level) continue;

      records.push({
        feature,
        sourceId: getFeatureSourceId(feature, featureFile, subclassId),
        sourceName:
          getFeatureName(feature) ||
          getFeatureSourceName(feature, featureFile, subclassId),
      });
    }
  }

  return records;
}

function buildSlotsFromClassResources(args: {
  draft: CharacterDraft;
  featureRecords: Array<{
    feature: JsonFeatureRecord;
    sourceId: string;
    sourceName: string;
  }>;
  allSpellOptions: SpellSelectionOption[];
  maxSpellLevel: number | null;
}): SpellSelectionSlot[] {
  const { draft, featureRecords, allSpellOptions, maxSpellLevel } = args;

  const knownSlots: SpellSelectionSlot[] = [];
  let knownIndex = 0;

  if (!draft.classId || draft.level === null) {
    return knownSlots;
  }

  const repertoire = resolveSpellRepertoire({
    draft,
    featureRecords: featureRecords.map(({ feature }) => ({ feature })),
  });

  let visibleSpellSelectionCount = repertoire.total;

  for (const { feature } of featureRecords) {
    const pactSlotCount = getPactSlotCountForFeature(feature, draft.level);

    if (pactSlotCount > 0) {
      visibleSpellSelectionCount = pactSlotCount;
      break;
    }
  }

  for (const { feature, sourceId, sourceName } of featureRecords) {
    const cantripCount = getResourceCountForFeature(feature, "cantrips", draft.level);

    if (cantripCount > 0) {
      const cantripOptions = filterOptionsForConstraints({
        options: allSpellOptions,
        allowedSpellLevels: [0],
      });

      for (let i = 0; i < cantripCount; i += 1) {
        knownSlots.push(
          buildGenericSlot({
            slotId: `${sourceId}:resource:cantrip:${i}`,
            sourceType: "class",
            sourceId,
            sourceName,
            bucket: "known",
            countsAgainstLimit: true,
            isAlwaysPrepared: false,
            selectedSpellId: draft.knownSpells[knownIndex++] ?? null,
            allowedSpellLevels: [0],
            options: cantripOptions,
          })
        );
      }

      break;
    }
  }

  if (visibleSpellSelectionCount > 0) {
    const leveledOptions = filterOptionsForConstraints({
      options: allSpellOptions,
      allowedSpellLevels:
        maxSpellLevel === null
          ? []
          : Array.from({ length: maxSpellLevel }, (_, i) => i + 1),
    });

    const primarySource =
      featureRecords.find(({ feature }) => {
        const resources = feature.resource?.resources ?? [];
        return resources.some((r) => r.resource_id === "spell_repertoire");
      }) ?? featureRecords[0];

    if (primarySource) {
      for (let i = 0; i < visibleSpellSelectionCount; i += 1) {
        knownSlots.push(
          buildGenericSlot({
            slotId: `${primarySource.sourceId}:resource:spell_repertoire:${i}`,
            sourceType: "class",
            sourceId: primarySource.sourceId,
            sourceName: primarySource.sourceName,
            bucket: "known",
            countsAgainstLimit: true,
            isAlwaysPrepared: false,
            selectedSpellId: draft.knownSpells[knownIndex++] ?? null,
            allowedSpellLevels:
              maxSpellLevel === null
                ? []
                : Array.from({ length: maxSpellLevel }, (_, i) => i + 1),
            options: leveledOptions,
          })
        );
      }
    }
  }

  return knownSlots;
}

function buildSlotsFromSelectionEntries(args: {
  draft: CharacterDraft;
  featureRecords: Array<{
    feature: JsonFeatureRecord;
    sourceId: string;
    sourceName: string;
  }>;
  allSpellOptions: SpellSelectionOption[];
  maxSpellLevel: number | null;
}): {
  knownSpellSlots: SpellSelectionSlot[];
  preparedSpellSlots: SpellSelectionSlot[];
  grantedSpellSlots: SpellSelectionSlot[];
} {
  const { draft, featureRecords, allSpellOptions, maxSpellLevel } = args;
  const knownSpellSlots: SpellSelectionSlot[] = [];
  const preparedSpellSlots: SpellSelectionSlot[] = [];
  const grantedSpellSlots: SpellSelectionSlot[] = [];
  let knownIndex = 0;
  let preparedIndex = 0;

  for (const { feature, sourceId, sourceName } of featureRecords) {
    const payload = feature.effects ?? feature.derivedEffects ?? feature.derived_effects;

    const selectionEntries = extractSpellSelectionEntries(feature);

    for (const [entryIndex, entry] of selectionEntries.entries()) {
      const bucketRaw =
        typeof entry.bucket === "string"
          ? normalizeText(entry.bucket)
          : typeof entry.selection_bucket === "string"
            ? normalizeText(entry.selection_bucket)
            : typeof entry.selectionBucket === "string"
              ? normalizeText(entry.selectionBucket)
              : typeof entry.type === "string"
                ? normalizeText(entry.type)
                : "known";

      const bucket: SpellSelectionBucket =
        bucketRaw === "prepared"
          ? "prepared"
          : bucketRaw === "granted" || bucketRaw === "grant"
            ? "granted"
            : "known";

      const kindRaw =
        typeof entry.kind === "string"
          ? normalizeText(entry.kind)
          : typeof entry.selection_kind === "string"
            ? normalizeText(entry.selection_kind)
            : typeof entry.selectionKind === "string"
              ? normalizeText(entry.selectionKind)
              : "selectable";

      const kind: SpellSelectionKind = kindRaw === "fixed" ? "fixed" : "selectable";
      const count = extractCount(entry, 1);
      const allowedSpellIds = extractSpellIds(entry);
      const allowedSchools = extractAllowedSchools(entry);
      const allowedSpellLevels = extractAllowedSpellLevels(entry, maxSpellLevel);
      const options = filterOptionsForConstraints({
        options: allSpellOptions,
        allowedSpellLevels,
        allowedSchools,
        allowedSpellIds,
      });

      for (let index = 0; index < count; index += 1) {
        const selectedSpellId =
          kind === "fixed"
            ? allowedSpellIds[index] ?? allowedSpellIds[0] ?? null
            : bucket === "prepared"
              ? draft.preparedSpells[preparedIndex++] ?? null
              : bucket === "known"
                ? draft.knownSpells[knownIndex++] ?? null
                : null;

        const slot = buildGenericSlot({
          slotId: `${sourceId}:selection:${entryIndex}:${index}`,
          sourceType: "feature",
          sourceId,
          sourceName,
          bucket,
          countsAgainstLimit: countsAgainstLimit(entry, true),
          isAlwaysPrepared: isAlwaysPrepared(entry),
          fixedSpellId: kind === "fixed" ? selectedSpellId : null,
          selectedSpellId,
          allowedSpellLevels,
          allowedSchools,
          allowedSpellIds,
          options:
            kind === "fixed" && selectedSpellId
              ? options.filter((option) => option.spellId === selectedSpellId)
              : options,
        });

        if (bucket === "prepared") {
          preparedSpellSlots.push(slot);
        } else if (bucket === "granted") {
          grantedSpellSlots.push(slot);
        } else {
          knownSpellSlots.push(slot);
        }
      }
    }
  }

  return { knownSpellSlots, preparedSpellSlots, grantedSpellSlots };
}

function buildSlotsFromGrantEntries(args: {
  featureRecords: Array<{
    feature: JsonFeatureRecord;
    sourceId: string;
    sourceName: string;
  }>;
  allSpellOptions: SpellSelectionOption[];
  maxSpellLevel: number | null;
}): SpellSelectionSlot[] {
  const { featureRecords, allSpellOptions, maxSpellLevel } = args;
  const grantedSpellSlots: SpellSelectionSlot[] = [];

  for (const { feature, sourceId, sourceName } of featureRecords) {
    const payload = feature.effects ?? feature.derivedEffects ?? feature.derived_effects;
    const rawEntries = extractSpellGrantEntries(feature);

    const seen = new Set<string>();

    for (const [grantIndex, grant] of rawEntries.entries()) {
      const spellIds = extractSpellIds(grant);
      const allowedSchools = extractAllowedSchools(grant);
      const allowedSpellLevels = extractAllowedSpellLevels(grant, maxSpellLevel);
      const count = extractCount(grant, 1);
      const alwaysPrepared = isAlwaysPrepared(grant);
      const againstLimit = countsAgainstLimit(grant, !alwaysPrepared);

      if (spellIds.length > 0) {
        for (const [spellIndex, spellId] of spellIds.entries()) {
          const key = `${sourceId}|fixed|${spellId}|${grantIndex}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const options = filterOptionsForConstraints({
            options: allSpellOptions,
            allowedSpellLevels,
            allowedSchools,
            allowedSpellIds: [spellId],
          });

          grantedSpellSlots.push(
            buildGenericSlot({
              slotId: `${sourceId}:grant:${grantIndex}:fixed:${spellIndex}`,
              sourceType: "feature",
              sourceId,
              sourceName,
              bucket: "granted",
              countsAgainstLimit: againstLimit,
              isAlwaysPrepared: alwaysPrepared,
              fixedSpellId: spellId,
              selectedSpellId: spellId,
              allowedSpellLevels,
              allowedSchools,
              allowedSpellIds: [spellId],
              options,
            })
          );
        }
        continue;
      }

      const options = filterOptionsForConstraints({
        options: allSpellOptions,
        allowedSpellLevels,
        allowedSchools,
      });

      for (let index = 0; index < count; index += 1) {
        grantedSpellSlots.push(
          buildGenericSlot({
            slotId: `${sourceId}:grant:${grantIndex}:choice:${index}`,
            sourceType: "feature",
            sourceId,
            sourceName,
            bucket: "granted",
            countsAgainstLimit: againstLimit,
            isAlwaysPrepared: alwaysPrepared,
            selectedSpellId: null,
            allowedSpellLevels,
            allowedSchools,
            options,
          })
        );
      }
    }
  }

  return grantedSpellSlots;
}

export function resolveSpellSelectionState(args: {
  draft: CharacterDraft;
  features?: ResolvedCharacterSheet["features"];
}): SpellSelectionState {
  const { draft } = args;
  const className = getClassName(draft.classId);
  const subclassName = draft.subclassId ?? "";
  const maxSpellLevel = getMaxSpellLevelFromProgression(draft);
  const allAvailableSpells = getAllClassSpellOptions(draft, maxSpellLevel);
  const featureFile = getClassFeatureFile(draft.classId) as JsonClassFeatureFile | null;
  const featureRecords = gatherFeatureRecords(draft, featureFile);

  const resourceKnownSlots = buildSlotsFromClassResources({
    draft,
    featureRecords,
    allSpellOptions: allAvailableSpells,
    maxSpellLevel,
  });

  const selectionSlots = buildSlotsFromSelectionEntries({
    draft,
    featureRecords,
    allSpellOptions: allAvailableSpells,
    maxSpellLevel,
  });

  const grantSlots = buildSlotsFromGrantEntries({
    featureRecords,
    allSpellOptions: allAvailableSpells,
    maxSpellLevel,
  });

  return {
    classId: draft.classId,
    subclassId: draft.subclassId,
    className,
    subclassName,
    maxSpellLevel,
    knownSpellSlots: [...resourceKnownSlots],
    preparedSpellSlots: selectionSlots.preparedSpellSlots,
    grantedSpellSlots: [...selectionSlots.grantedSpellSlots, ...grantSlots],
    allAvailableSpells: uniqueSpellOptions(allAvailableSpells),
  };
}