

export type AbilityId = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type FeatType =
  | "Origin"
  | "General"
  | "Epic Boon"
  | "Fighting Style";

export type ChoiceCountValue = number | "PB";

export interface NormalizedChoiceOption {
  id: string;
  label: string;
}

export interface NormalizedChoiceBlock {
  count?: ChoiceCountValue;
  pool?: string;
  pools?: string[];
  options?: string[];
  points?: number;
  perChoiceMax?: number;
  allowSameChoiceTwice?: boolean;
  scoreCap?: number;
  upgradeIfProficient?: boolean;
  requireProficiency?: boolean;
  excludeExistingProficiencies?: boolean;
  reassignableAfterLongRest?: boolean;
}

export interface NormalizedSpellGrant {
  kind: "fixed" | "choice";
  spells?: string[];
  count?: ChoiceCountValue;
  level?: number;
  schools?: string[];
  ritualOnly?: boolean;
}

export interface NormalizedSpeedBonus {
  type?: string;
  value?: number;
}

export interface NormalizedGrantedSpellcasting {
  abilityChoiceEffect?: string;
  spellSaveDc?: {
    base?: number;
    includeProficiencyBonus?: boolean;
  };
  spellAttackBonus?: {
    includeProficiencyBonus?: boolean;
  };
}

export interface NormalizedHitPointBonus {
  perLevel?: number;
}

export interface NormalizedUses {
  count?: ChoiceCountValue;
}

export interface NormalizedFeatEffects {
  abilityScoreChoices?: NormalizedChoiceBlock;
  spellcastingAbilityChoice?: NormalizedChoiceBlock;
  damageTypeChoice?: NormalizedChoiceBlock;
  toolChoices?: NormalizedChoiceBlock;
  proficiencyChoices?: NormalizedChoiceBlock;
  expertiseChoices?: NormalizedChoiceBlock;
  skillTrainingChoices?: NormalizedChoiceBlock;
  savingThrowChoices?: NormalizedChoiceBlock;
  weaponMasteryChoices?: NormalizedChoiceBlock;
  armorTrainingGrants?: string[];
  weaponTrainingGrants?: string[];
  hitPointBonus?: NormalizedHitPointBonus;
  grantedSpellcasting?: NormalizedGrantedSpellcasting;
  spellGrants?: NormalizedSpellGrant[];
  speedBonus?: NormalizedSpeedBonus;
  uses?: NormalizedUses;
  resistances?: unknown;
  gearSeedStub?: unknown;
}

export interface NormalizedFeatRequirements {
  ability?: string;
  feature?: string;
}

export interface NormalizedFeat {
  id: string;
  name: string;
  type: FeatType;
  minLevel: number;
  requirements: NormalizedFeatRequirements;
  effects: NormalizedFeatEffects;
  notes: string;
}

export interface NormalizedSkillChoiceBlock {
  count: number;
  options: string[];
}

export interface NormalizedClass {
  id: string;
  name: string;
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  savingThrowProficiencies: string[];
  skillChoices?: NormalizedSkillChoiceBlock | null;
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

export interface NormalizedFeatureChoice {
  kind: string;
  count?: number;
  countByLevel?: Array<{ level: number; value: number }>;
  pool?: string;
  options?: NormalizedChoiceOption[];
  components?: Array<{
    kind: string;
    count?: number;
    pool?: string;
    source?: string;
    options?: string[];
  }>;
  reassignableAfterLongRest?: boolean;
  changeRule?: string;
}

export interface NormalizedFeatureResource {
  kind: string;
  value?: number | string;
  recovery?: unknown;
  resources?: Array<{
    resourceId: string;
    resourceName: string;
    scaling: Array<{ level: number; value: string }>;
  }>;
}

export interface NormalizedFeature {
  id: string;
  name: string;
  description: string;
  level: number;
  type: string;
  choice?: NormalizedFeatureChoice;
  resource?: NormalizedFeatureResource;
  effects?: Record<string, unknown> | null;
  derivedEffects?: Record<string, unknown> | null;
  featureStack?: string | null;
  stackRole?: string | null;
  modifies?: string[];
}