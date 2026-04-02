import weaponsCsv from "../data/csv/weapons.csv?raw";
import skillsCsv from "../data/csv/skills.csv?raw";
import toolsCsv from "../data/csv/tools.csv?raw";
import { getClassFeatureFile } from "../data/classFeatures/classFeatureRegistry";
import {
  resolveChoiceOptionsFromPool,
  type SkillRow,
  type ToolRow,
  type WeaponRow,
} from "../data/loaders/choiceOptionLoader";
import { parseCsv } from "../data/loaders/csvParser";
import type { CharacterDraft } from "../types/draft";
import type { ResolvedCharacterSheet } from "../types/sheet";

const weaponRows = parseCsv<WeaponRow>(weaponsCsv);
const skillRows = parseCsv<SkillRow>(skillsCsv);
const toolRows = parseCsv<ToolRow>(toolsCsv);

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
  count_by_level?: Array<{ level: number; value: number }>;
  pool?: string[] | string | null;
  options?: JsonFeatureOption[];
  source?: string | null;
  components?: Array<{
    kind?: string | null;
    count?: number | null;
    source?: string | null;
    pool?: string[] | string | null;
    options?: JsonFeatureOption[];
  }>;
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
  selectionKey?: string | null;
  featureStack?: string | null;
  feature_stack?: string | null;
  stackRole?: string | null;
  stack_role?: string | null;
  modifies?: string[] | null;
  choiceKind?: string | null;
  choiceCount?: number | null;
  choiceCountByLevel?: Array<{ level: number; value: number }> | null;
  choicePool?: string[] | null;
  choiceOptions?: JsonFeatureOption[];
  choice?: JsonFeatureChoice;
};

type JsonSubclassFeatureBlock = {
  features: JsonFeatureRecord[];
};

type JsonClassFeatureFile = {
  classId?: string;
  className?: string;
  class_id?: string;
  class_name?: string;
  features: JsonFeatureRecord[];
  subclasses?: Record<string, JsonSubclassFeatureBlock>;
};

type NormalizedFeatureRecord = {
  featureId: string;
  featureName: string;
  level: number;
  description: string;
  subclassId: string | null;
  subclassName: string | null;
  sourceType: "class";
  sourceId: string;
  sourceName: string;
  derivedEffects: unknown;
  effects: unknown;
  selectionKey: string | null;
  featureStack: string | null;
  stackRole: string | null;
  choiceKind: string | null;
  choiceCount: number | null;
  choicePool: string[] | null;
  explicitChoiceOptions: JsonFeatureOption[];
  parentFeatureId: string | null;
};

function normalizeChoicePool(feature: JsonFeatureRecord): string[] | null {
  if (feature.choicePool && feature.choicePool.length > 0) {
    return feature.choicePool;
  }

  if (Array.isArray(feature.choice?.pool)) {
    return feature.choice.pool;
  }

  if (typeof feature.choice?.pool === "string") {
    return [feature.choice.pool];
  }

  return null;
}

function normalizeChoiceCount(
  feature: JsonFeatureRecord,
  currentLevel: number
): number | null {
  if (feature.choiceCount !== undefined && feature.choiceCount !== null) {
    return feature.choiceCount;
  }

  if (feature.choice?.count !== undefined && feature.choice?.count !== null) {
    return feature.choice.count;
  }

  const scaling = feature.choiceCountByLevel ?? feature.choice?.count_by_level ?? null;

  if (!scaling || scaling.length === 0) {
    return null;
  }

  const eligible = scaling
    .filter((entry) => entry.level <= currentLevel)
    .sort((a, b) => a.level - b.level);

  if (eligible.length === 0) {
    return null;
  }

  return eligible[eligible.length - 1].value;
}

function normalizeFeatureRecord(
  feature: JsonFeatureRecord,
  context: {
    classId: string;
    className: string;
    subclassId: string | null;
    currentLevel: number;
  }
): NormalizedFeatureRecord {
  const featureId = feature.featureId ?? feature.id ?? "";
  const featureName = feature.featureName ?? feature.name ?? "";
  const parentFeatureId = featureId;
  const subclassId = feature.subclassId ?? context.subclassId ?? null;
  const subclassName = feature.subclassName ?? null;
  const sourceId = feature.sourceId ?? (subclassId ? subclassId : context.classId);
  const sourceName = feature.sourceName ?? (subclassName ?? context.className);

  return {
    featureId,
    featureName,
    level: feature.level,
    description: feature.description,
    subclassId,
    subclassName,
    sourceType: feature.sourceType ?? "class",
    sourceId,
    sourceName,
    derivedEffects: feature.derivedEffects ?? feature.derived_effects ?? null,
    effects: feature.effects ?? null,
    selectionKey: feature.selectionKey ?? featureId ?? null,
    featureStack: feature.featureStack ?? feature.feature_stack ?? null,
    stackRole: feature.stackRole ?? feature.stack_role ?? null,
    choiceKind: feature.choiceKind ?? feature.choice?.kind ?? null,
    choiceCount: normalizeChoiceCount(feature, context.currentLevel),
    choicePool: normalizeChoicePool(feature),
    explicitChoiceOptions: feature.choiceOptions ?? feature.choice?.options ?? [],
    parentFeatureId,
  };
}

function expandCompoundFeatureRecords(feature: JsonFeatureRecord): JsonFeatureRecord[] {
  if (feature.choice?.kind !== "compound" || !feature.choice.components || feature.choice.components.length === 0) {
    return [feature];
  }

  const baseId = feature.featureId ?? feature.id ?? "";
  const baseName = feature.featureName ?? feature.name ?? "";

  return feature.choice.components.map((component, index) => {
    const componentKind = component.kind ?? null;
    const componentIdSuffix = componentKind ?? `component_${index + 1}`;
    const componentLabel = componentKind
      ? componentKind
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ")
      : `Component ${index + 1}`;

    let derivedPool: string[] | string | null = component.pool ?? null;

    if (!derivedPool) {
      if (componentKind === "skill_proficiency") {
        derivedPool = "skills";
      } else if (componentKind === "tool_proficiency" && component.source === "artisan_tools") {
        derivedPool = "artisan_tools";
      }
    }

    return {
      ...feature,
      featureId: `${baseId}__${componentIdSuffix}`,
      featureName: `${baseName} — ${componentLabel}`,
      selectionKey: `${baseId}__${componentIdSuffix}`,
      choiceKind: componentKind,
      choiceCount: component.count ?? 1,
      choicePool:
        Array.isArray(derivedPool)
          ? derivedPool
          : typeof derivedPool === "string"
            ? [derivedPool]
            : null,
      choiceOptions: component.options,
      choice: {
        kind: componentKind,
        count: component.count ?? 1,
        pool: derivedPool,
        options: component.options,
      },
    };
  });
}

function normalizeFeatureRecords(
  featureFile: JsonClassFeatureFile,
  draft: CharacterDraft
): NormalizedFeatureRecord[] {
  const classId = featureFile.classId ?? featureFile.class_id ?? draft.classId ?? "";
  const className = featureFile.className ?? featureFile.class_name ?? draft.classId ?? "";
  const subclassId = draft.subclassId ?? null;
  const subclassFeatures = subclassId
    ? featureFile.subclasses?.[subclassId]?.features ?? []
    : [];

  return [
    ...featureFile.features.flatMap((feature) =>
      expandCompoundFeatureRecords(feature).map((expandedFeature) =>
        normalizeFeatureRecord(expandedFeature, {
          classId,
          className,
          subclassId,
          currentLevel: draft.level ?? 0,
        })
      )
    ),
    ...subclassFeatures.flatMap((feature) =>
      expandCompoundFeatureRecords({
        ...feature,
        subclassId: feature.subclassId ?? subclassId ?? undefined,
      }).map((expandedFeature) =>
        normalizeFeatureRecord(expandedFeature, {
          classId,
          className,
          subclassId,
          currentLevel: draft.level ?? 0,
        })
      )
    ),
  ];
}

function mergeChoiceOptions(
  explicitOptions: JsonFeatureOption[],
  choicePool: string[] | null
): Array<{
  id: string;
  label: string;
  derivedEffects: unknown;
  effects: unknown;
}> {
  if (explicitOptions.length > 0) {
    return explicitOptions.map((option) => ({
      id: option.id,
      label: option.label,
      derivedEffects: option.derivedEffects ?? option.derived_effects ?? null,
      effects: option.effects ?? null,
    }));
  }

  if (!choicePool || choicePool.length === 0) {
    return [];
  }

  const merged = choicePool.flatMap((pool) =>
    resolveChoiceOptionsFromPool(pool, {
      weapons: weaponRows,
      skills: skillRows,
      tools: toolRows,
    })
  );

  const seen = new Set<string>();

  return merged.filter((option) => {
    if (seen.has(option.id)) {
      return false;
    }

    seen.add(option.id);
    return true;
  });
}

export function resolveFeatureOutputs(
  draft: CharacterDraft
): ResolvedCharacterSheet["features"] {
  const featureFile = getClassFeatureFile(
    draft.classId
  ) as JsonClassFeatureFile | null;

  if (!featureFile || draft.level === null) {
    return [];
  }

  const normalizedFeatures = normalizeFeatureRecords(featureFile, draft);

  const resolvedFeatures = normalizedFeatures
    .filter((feature) => {
      if (feature.level > draft.level!) {
        return false;
      }

      if (!feature.subclassId) {
        return true;
      }

      return feature.subclassId === (draft.subclassId ?? null);
    })
    .map((feature) => {
      const selections = feature.selectionKey
        ? draft.featureSelections[feature.selectionKey] ?? []
        : [];

      return {
        featureId: feature.featureId,
        featureName: feature.featureName,
        sourceType: feature.sourceType,
        sourceId: feature.sourceId,
        sourceName: feature.sourceName,
        levelGained: feature.level,
        description: feature.description,
        derivedEffects: feature.derivedEffects,
        effects: feature.effects,
        selectionKey: feature.selectionKey,
        choiceKind: feature.choiceKind,
        choiceCount: feature.choiceCount,
        choicePool: feature.choicePool,
        choiceOptions: mergeChoiceOptions(feature.explicitChoiceOptions, feature.choicePool),
        selections,
        featureStack: feature.featureStack,
        stackRole: feature.stackRole,
        parentFeatureId: feature.parentFeatureId,
      };
    });

  return resolvedFeatures.map((feature) => {
    if (feature.stackRole !== "base" || !feature.featureStack) {
      return feature;
    }

    const stackModifiers = resolvedFeatures.filter(
      (candidate) =>
        candidate.featureStack === feature.featureStack &&
        candidate.stackRole === "modifier"
    );

    if (stackModifiers.length === 0) {
      return feature;
    }

    const mergedSelections = Array.from(
      new Set([
        ...feature.selections,
        ...stackModifiers.flatMap((modifier) => modifier.selections),
      ])
    );

    const mergedChoiceOptions = Array.from(
      new Map(
        [
          ...feature.choiceOptions,
          ...stackModifiers.flatMap((modifier) => modifier.choiceOptions),
        ].map((option) => [option.id, option])
      ).values()
    );

    return {
      ...feature,
      selections: mergedSelections,
      choiceOptions: mergedChoiceOptions,
    };
  }) as ResolvedCharacterSheet["features"];
}