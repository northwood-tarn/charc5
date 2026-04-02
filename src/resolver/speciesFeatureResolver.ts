import speciesFeaturesCsv from "../data/csv/speciesFeatures.csv?raw";
import skillsCsv from "../data/csv/skills.csv?raw";
import { parseCsv } from "../data/loaders/csvParser";
import type { CharacterDraft } from "../types/draft";
import type { ResolvedCharacterSheet } from "../types/sheet";

interface SpeciesFeatureCsvRow {
  feature_id: string;
  species_id: string;
  lineage_id: string;
  feature_name: string;
  min_level: string;
  build_effect: string;
  description: string;
  grants_spell_id?: string;
}

interface SkillRow {
  skill_id: string;
  name?: string;
}

type ResolvedFeatureOutput = ResolvedCharacterSheet["features"][number];

type DraftWithFeatureSelections = CharacterDraft & {
  featureSelections?: Record<string, string[] | undefined>;
};

const speciesFeatureRows = parseCsv<SpeciesFeatureCsvRow>(speciesFeaturesCsv);
const skillRows = parseCsv<SkillRow>(skillsCsv);

const allSkillOptions = skillRows
  .filter((row) => typeof row.skill_id === "string" && row.skill_id.trim().length > 0)
  .map((row) => ({
    id: row.skill_id,
    label: row.name?.trim() || formatLabel(row.skill_id),
  }));

function formatLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseMinLevel(value: string | undefined): number {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) ? parsed : 1;
}

function getApplicableSpeciesFeatures(draft: CharacterDraft): SpeciesFeatureCsvRow[] {
  const speciesId = draft.speciesId ?? "";
  const lineageId = draft.lineageId ?? "";
  const level = draft.level ?? 1;

  if (!speciesId) {
    return [];
  }

  return speciesFeatureRows.filter((row) => {
    if (row.species_id !== speciesId) {
      return false;
    }

    const rowLineage = row.lineage_id?.trim() || "base";
    if (rowLineage !== "base" && rowLineage !== lineageId) {
      return false;
    }

    return parseMinLevel(row.min_level) <= level;
  });
}

function buildBaseSpeciesFeature(row: SpeciesFeatureCsvRow): ResolvedFeatureOutput {
  return {
    featureId: row.feature_id,
    featureName: row.feature_name,
    sourceType: "species" as ResolvedFeatureOutput["sourceType"],
    sourceId: row.feature_id,
    sourceName: row.feature_name,
    levelGained: parseMinLevel(row.min_level),
    description: row.description,
    derivedEffects:
      row.grants_spell_id && row.grants_spell_id.trim().length > 0
        ? {
            granted_spell_ids: [row.grants_spell_id.trim()],
          }
        : null,
    effects:
      row.build_effect === "hp_bonus_per_level"
        ? { hit_point_bonus: { per_level: 1 } }
        : null,
    selectionKey: row.feature_id,
    choiceKind: null,
    choiceCount: 0,
    choicePool: null,
    choiceOptions: [],
    selections: [],
    featureStack: null,
    stackRole: null,
    parentFeatureId: null,
  } as ResolvedFeatureOutput;
}

function getSkillChoiceOptions(row: SpeciesFeatureCsvRow): Array<{ id: string; label: string }> {
  const normalizedDescription = row.description.toLowerCase();

  if (
    normalizedDescription.includes("insight") &&
    normalizedDescription.includes("perception") &&
    normalizedDescription.includes("survival")
  ) {
    return [
      { id: "insight", label: "Insight" },
      { id: "perception", label: "Perception" },
      { id: "survival", label: "Survival" },
    ];
  }

  return allSkillOptions;
}

function buildChoiceSpeciesFeature(row: SpeciesFeatureCsvRow): ResolvedFeatureOutput[] {
  if (row.build_effect === "skill_choice") {
    const base = buildBaseSpeciesFeature(row);
    const choiceFeatureId = `${row.feature_id}__skill_choice`;

    const choiceFeature = {
      featureId: choiceFeatureId,
      featureName: `${row.feature_name} — Skill Choice`,
      sourceType: "species" as ResolvedFeatureOutput["sourceType"],
      sourceId: row.feature_id,
      sourceName: row.feature_name,
      levelGained: parseMinLevel(row.min_level),
      description: row.description,
      derivedEffects: null,
      effects: null,
      selectionKey: choiceFeatureId,
      choiceKind: "skill_proficiency",
      choiceCount: 1,
      choicePool: ["skills"],
      choiceOptions: getSkillChoiceOptions(row),
      selections: [],
      featureStack: null,
      stackRole: null,
      parentFeatureId: row.feature_id,
    } as ResolvedFeatureOutput;

    return [base, choiceFeature];
  }

  if (row.build_effect === "feat_choice") {
    const base = buildBaseSpeciesFeature(row);
    const choiceFeatureId = `${row.feature_id}__feat_choice`;

    const choiceFeature = {
      featureId: choiceFeatureId,
      featureName: `${row.feature_name} — Feat Choice`,
      sourceType: "species" as ResolvedFeatureOutput["sourceType"],
      sourceId: row.feature_id,
      sourceName: row.feature_name,
      levelGained: parseMinLevel(row.min_level),
      description: row.description,
      derivedEffects: null,
      effects: {
        feat_type_filter: "Origin",
      },
      selectionKey: choiceFeatureId,
      choiceKind: "feat_choice",
      choiceCount: 1,
      choicePool: ["origin_feats"],
      choiceOptions: [],
      selections: [],
      featureStack: null,
      stackRole: null,
      parentFeatureId: row.feature_id,
    } as ResolvedFeatureOutput;

    return [base, choiceFeature];
  }

  return [buildBaseSpeciesFeature(row)];
}

function applyDraftSelections(
  draft: CharacterDraft,
  features: ResolvedCharacterSheet["features"]
): ResolvedCharacterSheet["features"] {
  const featureSelections = (draft as DraftWithFeatureSelections).featureSelections ?? {};

  return features.map((feature) => {
    const selectionKey = (feature.selectionKey ?? feature.featureId) as string;
    return {
      ...feature,
      selections: featureSelections[selectionKey] ?? feature.selections ?? [],
    };
  }) as ResolvedCharacterSheet["features"];
}

export function getSpeciesFeatureDefinitions(): SpeciesFeatureCsvRow[] {
  return speciesFeatureRows;
}

export function resolveSpeciesFeatureOutputs(
  draft: CharacterDraft
): ResolvedCharacterSheet["features"] {
  const applicableRows = getApplicableSpeciesFeatures(draft);

  const resolved = applicableRows.flatMap((row) => buildChoiceSpeciesFeature(row)) as ResolvedCharacterSheet["features"];

  return applyDraftSelections(draft, resolved);
}
