import { getSpellById } from "../data/loaders/spellsLoader";
import type { CharacterDraft } from "../types/draft";
import type { ResolvedCharacterSheet } from "../types/sheet";

export type SpellGrantSourceRecord = {
  sourceType: "class" | "feature";
  sourceId: string;
  sourceName: string;
  grantedSpellIds: string[];
  isAlwaysPrepared: boolean;
  countsAgainstLimit: boolean;
};

export type JsonFeatureOptionLike = {
  id: string;
  label: string;
  derivedEffects?: unknown;
  derived_effects?: unknown;
  effects?: unknown;
};

export type JsonFeatureLike = {
  featureId: string;
  featureName: string;
  sourceType: "class";
  sourceId: string;
  sourceName: string;
  selections: string[];
  choiceOptions: JsonFeatureOptionLike[];
  derivedEffects?: unknown;
  effects?: unknown;
};

function normalizeSpellId(value: string): string {
  return value.trim();
}

function uniqueSpellIds(spellIds: string[]): string[] {
  return Array.from(
    new Set(spellIds.map(normalizeSpellId).filter(Boolean))
  );
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function extractGrantedSpellIdsFromDerivedEffects(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;

  return uniqueSpellIds([
    ...asStringArray(record.grantedSpellIds),
    ...asStringArray(record.granted_spell_ids),
    ...asStringArray(record.alwaysPreparedSpellIds),
    ...asStringArray(record.always_prepared_spell_ids),
    ...asStringArray(record.preparedSpellIds),
    ...asStringArray(record.prepared_spell_ids),
  ]);
}

function extractSpellGrantRecordsFromEffects(value: unknown): Array<{
  spellIds: string[];
  isAlwaysPrepared: boolean;
  countsAgainstLimit: boolean;
}> {
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const directSpellGrants =
    record.spell_grants ?? record.spellGrants ?? record.spell_grant ?? record.spellGrant;
  const nestedEffects =
    record.effects && typeof record.effects === "object"
      ? (record.effects as Record<string, unknown>)
      : null;
  const spellGrants = Array.isArray(directSpellGrants)
    ? directSpellGrants
    : Array.isArray(nestedEffects?.spell_grants)
      ? nestedEffects?.spell_grants
      : Array.isArray(nestedEffects?.spellGrants)
        ? nestedEffects?.spellGrants
        : Array.isArray(nestedEffects?.spell_grant)
          ? nestedEffects?.spell_grant
          : Array.isArray(nestedEffects?.spellGrant)
            ? nestedEffects?.spellGrant
            : null;

  if (!Array.isArray(spellGrants)) {
    return [];
  }

  return spellGrants.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const grant = entry as Record<string, unknown>;
    const spellIds = uniqueSpellIds([
      ...asStringArray(grant.spells),
      ...asStringArray(grant.spell_ids),
      ...asStringArray(grant.spellIds),
    ]);

    if (spellIds.length === 0) {
      return [];
    }

    const kind =
      typeof grant.kind === "string" ? grant.kind.trim().toLowerCase() : "";
    const alwaysPrepared =
      grant.always_prepared === true ||
      grant.alwaysPrepared === true ||
      kind === "fixed";
    const countsAgainstLimit =
      grant.counts_against_limit === true ||
      grant.countsAgainstLimit === true
        ? true
        : grant.counts_against_limit === false ||
            grant.countsAgainstLimit === false ||
            alwaysPrepared
          ? false
          : true;

    return [
      {
        spellIds,
        isAlwaysPrepared: alwaysPrepared,
        countsAgainstLimit,
      },
    ];
  });
}

function createStructuredSpellOutput(
  spellId: string,
  sourceType: "class" | "feature",
  sourceId: string,
  sourceName: string,
  isAlwaysPrepared: boolean,
  countsAgainstLimit: boolean
): ResolvedCharacterSheet["spellcasting"]["knownSpells"][number] {
  const spell = getSpellById(spellId);

  return {
    spellId,
    spellName: spell?.name ?? spellId,
    sourceType,
    sourceId,
    sourceName,
    spellLevel: spell?.level ?? null,
    school: spell?.school ?? "",
    isAlwaysPrepared,
    countsAgainstLimit,
  };
}

function sortStructuredSpells<T extends { spellLevel: number | null; spellName: string }>(
  spells: T[]
): T[] {
  return [...spells].sort((a, b) => {
    const levelA = a.spellLevel ?? 99;
    const levelB = b.spellLevel ?? 99;

    if (levelA !== levelB) {
      return levelA - levelB;
    }

    return a.spellName.localeCompare(b.spellName);
  });
}

function dedupeSpellGrantSources(
  sources: SpellGrantSourceRecord[]
): SpellGrantSourceRecord[] {
  const byKey = new Map<string, SpellGrantSourceRecord>();

  for (const source of sources) {
    const spellIds = uniqueSpellIds(source.grantedSpellIds);

    if (spellIds.length === 0) {
      continue;
    }

    const key = [
      source.sourceType,
      source.sourceId,
      source.sourceName,
      source.isAlwaysPrepared ? "always" : "not_always",
      source.countsAgainstLimit ? "counts" : "free",
    ].join("::");

    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        ...source,
        grantedSpellIds: spellIds,
      });
      continue;
    }

    byKey.set(key, {
      ...existing,
      grantedSpellIds: uniqueSpellIds([
        ...existing.grantedSpellIds,
        ...spellIds,
      ]),
    });
  }

  return Array.from(byKey.values());
}

export function getSelectedOptionSpellGrantSources(
  features: JsonFeatureLike[]
): SpellGrantSourceRecord[] {
  const sources = features.flatMap((feature) => {
    const selectedOptions = feature.choiceOptions.filter((option) =>
      feature.selections.includes(option.id)
    );

    return selectedOptions.flatMap((option) => {
      const derivedSpellIds = extractGrantedSpellIdsFromDerivedEffects(
        option.derivedEffects ?? option.derived_effects
      );

      const directRecords: SpellGrantSourceRecord[] =
        derivedSpellIds.length > 0
          ? [
              {
                sourceType: "feature",
                sourceId: feature.sourceId,
                sourceName: option.label,
                grantedSpellIds: derivedSpellIds,
                isAlwaysPrepared: true,
                countsAgainstLimit: false,
              },
            ]
          : [];

      const effectRecords = extractSpellGrantRecordsFromEffects(
        option.effects ?? option.derivedEffects ?? option.derived_effects
      ).map((record) => ({
        sourceType: "feature" as const,
        sourceId: feature.sourceId,
        sourceName: option.label,
        grantedSpellIds: record.spellIds,
        isAlwaysPrepared: record.isAlwaysPrepared,
        countsAgainstLimit: record.countsAgainstLimit,
      }));

      return [...directRecords, ...effectRecords];
    });
  });

  return dedupeSpellGrantSources(sources);
}

export function getJsonFeatureSpellGrantSources(
  features: JsonFeatureLike[]
): SpellGrantSourceRecord[] {
  const sourceTypes = new Set(
    features.map((f) => String((f as { sourceType?: unknown }).sourceType ?? ""))
  );

  const speciesOnly = sourceTypes.size === 1 && sourceTypes.has("species");

  const filteredFeatures = speciesOnly
    ? features
    : features.filter(
        (feature) =>
          String((feature as { sourceType?: unknown }).sourceType ?? "") !== "species"
      );

  return dedupeSpellGrantSources(
    filteredFeatures.flatMap((feature) => {
      const directDerivedSpellIds = extractGrantedSpellIdsFromDerivedEffects(
        feature.derivedEffects
      );

      const directRecords: SpellGrantSourceRecord[] =
        directDerivedSpellIds.length > 0
          ? [
              {
                sourceType: "feature",
                sourceId: feature.sourceId,
                sourceName: feature.featureName,
                grantedSpellIds: directDerivedSpellIds,
                isAlwaysPrepared: true,
                countsAgainstLimit: false,
              },
            ]
          : [];

      const effectRecords = extractSpellGrantRecordsFromEffects(
        feature.effects ?? feature.derivedEffects
      ).map((record) => ({
        sourceType: "feature" as const,
        sourceId: feature.sourceId,
        sourceName: feature.featureName,
        grantedSpellIds: record.spellIds,
        isAlwaysPrepared: record.isAlwaysPrepared,
        countsAgainstLimit: record.countsAgainstLimit,
      }));

      return [...directRecords, ...effectRecords];
    })
  );
}

export function resolveStructuredKnownSpells(
  draft: CharacterDraft,
  className: string,
  subclassName: string
): ResolvedCharacterSheet["spellcasting"]["knownSpells"] {
  const sourceId = draft.subclassId ?? draft.classId ?? "";
  const sourceName = draft.subclassId ? subclassName : className;

  return sortStructuredSpells(
    draft.knownSpells.map((spellId) =>
      createStructuredSpellOutput(
        spellId,
        "class",
        sourceId,
        sourceName,
        false,
        true
      )
    )
  );
}

export function resolveStructuredPreparedSpells(args: {
  draft: CharacterDraft;
  className: string;
  subclassName: string;
  csvFeatureSpellSources?: SpellGrantSourceRecord[];
  jsonFeatureSpellSources?: SpellGrantSourceRecord[];
  selectedOptionSpellSources?: SpellGrantSourceRecord[];
}): ResolvedCharacterSheet["spellcasting"]["preparedSpells"] {
  const {
    draft,
    className,
    subclassName,
    csvFeatureSpellSources = [],
    jsonFeatureSpellSources = [],
    selectedOptionSpellSources = [],
  } = args;

  const selectedPrepared = draft.preparedSpells.map((spellId) =>
    createStructuredSpellOutput(
      spellId,
      "class",
      draft.subclassId ?? draft.classId ?? "",
      draft.subclassId ? subclassName : className,
      false,
      true
    )
  );

  const grantedPrepared = dedupeSpellGrantSources([
    ...csvFeatureSpellSources,
    ...jsonFeatureSpellSources,
    ...selectedOptionSpellSources,
  ]).flatMap((source) =>
    source.grantedSpellIds.map((spellId) =>
      createStructuredSpellOutput(
        spellId,
        source.sourceType,
        source.sourceId,
        source.sourceName,
        source.isAlwaysPrepared,
        source.countsAgainstLimit
      )
    )
  );

  const deduped = new Map<
    string,
    ResolvedCharacterSheet["spellcasting"]["preparedSpells"][number]
  >();

  [...grantedPrepared, ...selectedPrepared].forEach((entry) => {
    const existing = deduped.get(entry.spellId);

    if (!existing) {
      deduped.set(entry.spellId, entry);
      return;
    }

    if (entry.isAlwaysPrepared && !existing.isAlwaysPrepared) {
      deduped.set(entry.spellId, entry);
      return;
    }

    if (!entry.countsAgainstLimit && existing.countsAgainstLimit) {
      deduped.set(entry.spellId, entry);
    }
  });

  return sortStructuredSpells(Array.from(deduped.values()));
}