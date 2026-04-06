import featsJson from "../feats.json";
import type {
  ChoiceCountValue,
  FeatType,
  NormalizedChoiceBlock,
  NormalizedFeat,
  NormalizedFeatEffects,
  NormalizedFeatRequirements,
  NormalizedGrantedSpellcasting,
  NormalizedHitPointBonus,
  NormalizedSpellGrant,
  NormalizedSpeedBonus,
  NormalizedUses,
} from "../../engine/contracts/dataContracts";


function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asChoiceCountValue(value: unknown): ChoiceCountValue | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value === "PB") {
    return "PB";
  }

  return undefined;
}

function asStringRecordArray(value: unknown): string[] {
  return asStringArray(value).map((entry) => entry.trim()).filter(Boolean);
}

function parseChoiceBlock(value: unknown): NormalizedChoiceBlock | undefined {
  const record = asObject(value);
  if (Object.keys(record).length === 0) {
    return undefined;
  }

  return {
    count: asChoiceCountValue(record.count),
    pool: asString(record.pool) || undefined,
    pools: asStringRecordArray(record.pools),
    options: asStringRecordArray(record.options),
    points:
      typeof record.points === "number" && Number.isFinite(record.points)
        ? record.points
        : undefined,
    perChoiceMax:
      typeof record.per_choice_max === "number" && Number.isFinite(record.per_choice_max)
        ? record.per_choice_max
        : undefined,
    allowSameChoiceTwice:
      typeof record.allow_same_choice_twice === "boolean"
        ? record.allow_same_choice_twice
        : undefined,
    scoreCap:
      typeof record.score_cap === "number" && Number.isFinite(record.score_cap)
        ? record.score_cap
        : undefined,
    upgradeIfProficient:
      typeof record.upgrade_if_proficient === "boolean"
        ? record.upgrade_if_proficient
        : undefined,
    requireProficiency:
      typeof record.require_proficiency === "boolean"
        ? record.require_proficiency
        : undefined,
    excludeExistingProficiencies:
      typeof record.exclude_existing_proficiencies === "boolean"
        ? record.exclude_existing_proficiencies
        : undefined,
    reassignableAfterLongRest:
      typeof record.reassignable_after_long_rest === "boolean"
        ? record.reassignable_after_long_rest
        : undefined,
  };
}

function parseSpellGrant(value: unknown): NormalizedSpellGrant | undefined {
  const record = asObject(value);
  const kind = asString(record.kind);
  if (kind !== "fixed" && kind !== "choice") {
    return undefined;
  }

  return {
    kind,
    spells: asStringRecordArray(record.spells),
    count: asChoiceCountValue(record.count),
    level:
      typeof record.level === "number" && Number.isFinite(record.level)
        ? record.level
        : undefined,
    schools: asStringRecordArray(record.schools),
    ritualOnly:
      typeof record.ritual_only === "boolean" ? record.ritual_only : undefined,
  };
}

function parseGrantedSpellcasting(value: unknown): NormalizedGrantedSpellcasting | undefined {
  const record = asObject(value);
  if (Object.keys(record).length === 0) {
    return undefined;
  }

  const spellSaveDcRecord = asObject(record.spell_save_dc);
  const spellAttackBonusRecord = asObject(record.spell_attack_bonus);

  return {
    abilityChoiceEffect: asString(record.ability_choice_effect) || undefined,
    spellSaveDc:
      Object.keys(spellSaveDcRecord).length > 0
        ? {
            base:
              typeof spellSaveDcRecord.base === "number" && Number.isFinite(spellSaveDcRecord.base)
                ? spellSaveDcRecord.base
                : undefined,
            includeProficiencyBonus:
              typeof spellSaveDcRecord.include_proficiency_bonus === "boolean"
                ? spellSaveDcRecord.include_proficiency_bonus
                : undefined,
          }
        : undefined,
    spellAttackBonus:
      Object.keys(spellAttackBonusRecord).length > 0
        ? {
            includeProficiencyBonus:
              typeof spellAttackBonusRecord.include_proficiency_bonus === "boolean"
                ? spellAttackBonusRecord.include_proficiency_bonus
                : undefined,
          }
        : undefined,
  };
}

function parseHitPointBonus(value: unknown): NormalizedHitPointBonus | undefined {
  const record = asObject(value);
  if (Object.keys(record).length === 0) {
    return undefined;
  }

  return {
    perLevel:
      typeof record.per_level === "number" && Number.isFinite(record.per_level)
        ? record.per_level
        : undefined,
  };
}

function parseUses(value: unknown): NormalizedUses | undefined {
  const record = asObject(value);
  if (Object.keys(record).length === 0) {
    return undefined;
  }

  return {
    count: asChoiceCountValue(record.count),
  };
}

function parseSpeedBonus(value: unknown): NormalizedSpeedBonus | undefined {
  const record = asObject(value);
  if (Object.keys(record).length === 0) {
    return undefined;
  }

  return {
    type: asString(record.type) || undefined,
    value:
      typeof record.value === "number" && Number.isFinite(record.value)
        ? record.value
        : undefined,
  };
}

function parseFeatRequirements(value: unknown): NormalizedFeatRequirements {
  const record = asObject(value);
  return {
    ability: asString(record.ability) || undefined,
    feature: asString(record.feature) || undefined,
  };
}

function parseFeatEffects(value: unknown): NormalizedFeatEffects {
  const record = asObject(value);

  return {
    abilityScoreChoices: parseChoiceBlock(record.ability_score_choices),
    spellcastingAbilityChoice: parseChoiceBlock(record.spellcasting_ability_choice),
    damageTypeChoice: parseChoiceBlock(record.damage_type_choice),
    toolChoices: parseChoiceBlock(record.tool_choices),
    proficiencyChoices: parseChoiceBlock(record.proficiency_choices),
    expertiseChoices: parseChoiceBlock(record.expertise_choices),
    skillTrainingChoices: parseChoiceBlock(record.skill_training_choices),
    savingThrowChoices: parseChoiceBlock(record.saving_throw_choices),
    weaponMasteryChoices: parseChoiceBlock(record.weapon_mastery_choices),
    armorTrainingGrants: asStringRecordArray(record.armor_training_grants),
    weaponTrainingGrants: asStringRecordArray(record.weapon_training_grants),
    hitPointBonus: parseHitPointBonus(record.hit_point_bonus),
    grantedSpellcasting: parseGrantedSpellcasting(record.granted_spellcasting),
    spellGrants: Array.isArray(record.spell_grants)
      ? record.spell_grants
          .map((entry) => parseSpellGrant(entry))
          .filter((entry): entry is NormalizedSpellGrant => !!entry)
      : undefined,
    speedBonus: parseSpeedBonus(record.speed_bonus),
    uses: parseUses(record.uses),
    resistances: record.resistances,
    gearSeedStub: record.gear_seed_stub,
  };
}

function parseFeatType(value: unknown, index: number): FeatType {
  const type = asString(value);
  if (
    type === "Origin" ||
    type === "General" ||
    type === "Epic Boon" ||
    type === "Fighting Style"
  ) {
    return type;
  }

  throw new Error(`Invalid feat type in feats.json entry ${index + 1}`);
}

function parseFeatRecord(raw: unknown, index: number): NormalizedFeat {
  const record = asObject(raw);
  const id = asString(record.feat_id || record.id);
  const name = asString(record.name);
  const notes = asString(record.notes || record.description);

  if (!id) {
    throw new Error(`Missing feat_id in feats.json entry ${index + 1}`);
  }

  if (!name) {
    throw new Error(`Missing name in feats.json entry ${index + 1}`);
  }

  if (!notes) {
    throw new Error(`Missing notes in feats.json entry ${index + 1}`);
  }

  return {
    id,
    name,
    type: parseFeatType(record.type, index),
    minLevel:
      typeof record.min_level === "number" && Number.isFinite(record.min_level)
        ? record.min_level
        : 0,
    requirements: parseFeatRequirements(record.requirements),
    effects: parseFeatEffects(record.effects),
    notes,
  };
}

const rawFeats = Array.isArray(featsJson) ? featsJson : [];

const feats: NormalizedFeat[] = rawFeats.map((entry, index) =>
  parseFeatRecord(entry, index)
);

export function getFeats(): NormalizedFeat[] {
  return feats;
}

export function getFeatById(id: string | null | undefined): NormalizedFeat | null {
  if (!id) {
    return null;
  }

  return feats.find((feat) => feat.id === id) ?? null;
}
