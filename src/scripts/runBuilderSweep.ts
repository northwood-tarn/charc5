import { resolveCharacterSheet } from "../resolver/resolveCharacterSheet.ts";
import type { CharacterDraft } from "../types/draft.ts";

type SweepFailure = {
  caseId: string;
  errors: string[];
};

type FeatureEntry = {
  id?: string;
  featureId?: string;
  name?: string;
  featureName?: string;
  type?: string;
  featureType?: string;
  sourceType?: string;
  sourceId?: string;
  sourceName?: string;
  choiceKind?: string | null;
  selections?: string[];
  choiceOptions?: Array<unknown>;
  derivedEffects?: unknown;
  effects?: unknown;
};

function createBaseDraft(): CharacterDraft {
  return {
    characterName: "Feature Sweep",
    classId: "fighter",
    subclassId: null,
    level: 1,
    speciesId: "human",
    lineageId: "base",
    backgroundId: "acolyte",
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    featureSelections: {},
    featSelections: {},
    languageSelections: [],
    weaponIds: [],
    armorId: null,
    hasShield: false,
    spellSelections: {},
    skillProficiencies: [],
    toolProficiencies: [],
    equipment: [],
    knownSpells: [],
    preparedSpells: [],
  };
}

function buildDraft(overrides: Partial<CharacterDraft>): CharacterDraft {
  const base = createBaseDraft();
  return {
    ...base,
    ...overrides,
    abilities: {
      ...base.abilities,
      ...(overrides.abilities ?? {}),
    },
    featureSelections: {
      ...base.featureSelections,
      ...(overrides.featureSelections ?? {}),
    },
    featSelections: {
      ...base.featSelections,
      ...(overrides.featSelections ?? {}),
    },
    languageSelections: overrides.languageSelections ?? [],
    weaponIds: overrides.weaponIds ?? [],
    skillProficiencies: overrides.skillProficiencies ?? [],
    toolProficiencies: overrides.toolProficiencies ?? [],
    equipment: overrides.equipment ?? [],
    knownSpells: overrides.knownSpells ?? [],
    preparedSpells: overrides.preparedSpells ?? [],
  };
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function getFeatureId(feature: FeatureEntry): string {
  return normalize(
    feature.id ??
      feature.featureId ??
      feature.name ??
      feature.featureName ??
      ""
  );
}

function getFeatureType(feature: FeatureEntry): string {
  return normalize(feature.type ?? feature.featureType ?? "");
}

function getFeatureName(feature: FeatureEntry): string {
  return feature.featureName ?? feature.name ?? feature.featureId ?? feature.id ?? "(unknown)";
}

function printFeatures(caseName: string, features: FeatureEntry[]) {
  console.log(`\n${caseName}`);
  features.forEach((feature) => {
    console.log(
      `- ${getFeatureId(feature) || "(unknown)"} | name=${getFeatureName(feature)} | type=${getFeatureType(feature) || "null"} | sourceType=${feature.sourceType ?? "null"} | sourceId=${feature.sourceId ?? "null"}`
    );
  });
}

function assertExpectedFeaturesPresent(
  features: FeatureEntry[],
  expectedIds: string[],
  errors: string[]
) {
  const ids = features.map(getFeatureId);
  for (const expectedId of expectedIds) {
    if (!ids.includes(normalize(expectedId))) {
      errors.push(`missing expected feature: ${expectedId}`);
    }
  }
}

function assertNoDuplicateFeatureIds(
  features: FeatureEntry[],
  errors: string[]
) {
  const ids = features.map(getFeatureId).filter(Boolean);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  for (const duplicate of duplicates) {
    errors.push(`duplicate feature id: ${duplicate}`);
  }
}

function assertSubclassAdditive(
  baseFeatures: FeatureEntry[],
  subclassFeatures: FeatureEntry[],
  errors: string[]
) {
  const baseIds = new Set(baseFeatures.map(getFeatureId).filter(Boolean));
  const subclassIds = new Set(subclassFeatures.map(getFeatureId).filter(Boolean));

  for (const id of baseIds) {
    if (!subclassIds.has(id)) {
      errors.push(`subclass resolution dropped core feature: ${id}`);
    }
  }
}


function assertLevelGating(
  lowerLevelFeatures: FeatureEntry[],
  higherLevelFeatures: FeatureEntry[],
  forbiddenAtLowLevel: string[],
  expectedAtHighLevel: string[],
  errors: string[]
) {
  const lowIds = lowerLevelFeatures.map(getFeatureId);
  const highIds = higherLevelFeatures.map(getFeatureId);

  for (const id of forbiddenAtLowLevel) {
    if (lowIds.includes(normalize(id))) {
      errors.push(`feature appeared too early: ${id}`);
    }
  }

  for (const id of expectedAtHighLevel) {
    if (!highIds.includes(normalize(id))) {
      errors.push(`feature missing at expected higher level: ${id}`);
    }
  }
}

function runCase(
  caseId: string,
  draft: CharacterDraft,
  expectedIds: string[],
  options?: {
    compareAgainstBaseDraft?: CharacterDraft;
    forbiddenAtLowLevel?: string[];
    highLevelDraft?: CharacterDraft;
    expectedAtHighLevel?: string[];
  }
): SweepFailure | null {
  const sheet = resolveCharacterSheet(draft);
  const features = (sheet.features ?? []) as FeatureEntry[];
  const errors: string[] = [];

  printFeatures(caseId, features);

  assertExpectedFeaturesPresent(features, expectedIds, errors);
  assertNoDuplicateFeatureIds(features, errors);

  if (options?.compareAgainstBaseDraft) {
    const baseSheet = resolveCharacterSheet(options.compareAgainstBaseDraft);
    const baseFeatures = (baseSheet.features ?? []) as FeatureEntry[];
    assertSubclassAdditive(baseFeatures, features, errors);
  }

  if (options?.highLevelDraft && options?.forbiddenAtLowLevel && options?.expectedAtHighLevel) {
    const lowSheet = resolveCharacterSheet(draft);
    const highSheet = resolveCharacterSheet(options.highLevelDraft);
    const lowFeatures = (lowSheet.features ?? []) as FeatureEntry[];
    const highFeatures = (highSheet.features ?? []) as FeatureEntry[];

    assertLevelGating(
      lowFeatures,
      highFeatures,
      options.forbiddenAtLowLevel,
      options.expectedAtHighLevel,
      errors
    );
  }

  return errors.length > 0 ? { caseId, errors } : null;
}

function runFeatureResolutionSweep(): SweepFailure[] {
  const failures: SweepFailure[] = [];

  const fighter5 = buildDraft({
    classId: "fighter",
    subclassId: null,
    level: 5,
  });

  const battleMaster5 = buildDraft({
    classId: "fighter",
    subclassId: "battle_master",
    level: 5,
  });

  const rogue7 = buildDraft({
    classId: "rogue",
    subclassId: "arcane_trickster",
    level: 7,
  });

  const wizard17 = buildDraft({
    classId: "wizard",
    subclassId: null,
    level: 17,
  });

  const wizard20 = buildDraft({
    classId: "wizard",
    subclassId: null,
    level: 20,
  });

  const monk2 = buildDraft({
    classId: "monk",
    subclassId: null,
    level: 2,
  });

  const monk5 = buildDraft({
    classId: "monk",
    subclassId: null,
    level: 5,
  });

  const cases = [
    runCase(
      "fighter level 5 core features",
      fighter5,
      ["second_wind", "action_surge", "extra_attack"]
    ),
    runCase(
      "fighter battle master features additive",
      battleMaster5,
      ["second_wind", "action_surge", "extra_attack", "combat_superiority"],
      {
        compareAgainstBaseDraft: fighter5,
      }
    ),
    runCase(
      "rogue arcane trickster progression",
      rogue7,
      ["sneak_attack", "mage_hand_legerdemain"]
    ),
    runCase(
      "wizard capstone level gating",
      wizard17,
      [],
      {
        highLevelDraft: wizard20,
        forbiddenAtLowLevel: ["spell_mastery", "signature_spells"],
        expectedAtHighLevel: ["spell_mastery", "signature_spells"],
      }
    ),
    runCase(
      "monk extra attack level gating",
      monk2,
      [],
      {
        highLevelDraft: monk5,
        forbiddenAtLowLevel: ["extra_attack"],
        expectedAtHighLevel: ["extra_attack"],
      }
    ),
  ];

  cases.forEach((failure) => {
    if (failure) failures.push(failure);
  });

  return failures;
}

function printFailures(failures: SweepFailure[]) {
  console.log("");

  if (failures.length === 0) {
    console.log("Feature resolution diagnostics OK");
    return;
  }

  console.log(`Feature resolution failures: ${failures.length}`);
  failures.forEach((failure) => {
    console.log(failure.caseId);
    failure.errors.forEach((error) => console.log(`- ${error}`));
  });
}

const failures = runFeatureResolutionSweep();
printFailures(failures);