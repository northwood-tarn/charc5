// Resolved sheet output contract for V5.
// This is the authoritative shape the sheet renderer consumes.
// Every section is always present, even when empty.

export type AbilityId =
  | "str"
  | "dex"
  | "con"
  | "int"
  | "wis"
  | "cha";

export type SpeedType =
  | "walk"
  | "fly"
  | "swim"
  | "climb"
  | "burrow";

export type SenseType =
  | "darkvision"
  | "blindsight"
  | "tremorsense"
  | "truesight";

export type ProficiencyLevel =
  | "none"
  | "proficient"
  | "expertise";

export type RecoveryType =
  | "short_rest"
  | "long_rest"
  | "special"
  | "none";

export type FeatureSourceType =
  | "class"
  | "subclass"
  | "species"
  | "lineage"
  | "background"
  | "feat"
  | "other";

export type SpellSelectionSourceType =
  | "class"
  | "subclass"
  | "species"
  | "background"
  | "feat"
  | "other";

export type SpellSelectionBucket =
  | "known"
  | "prepared"
  | "granted";

export type SpellSelectionKind =
  | "fixed"
  | "selectable";

export interface DerivationLine {
  label: string;
  value: number | string;
  source: string;
}

export interface DerivedValue {
  value: number | string;
  derivation: DerivationLine[];
}

export interface IdentityOutput {
  characterName: string;
  classId: string | null;
  className: string;
  subclassId: string | null;
  subclassName: string;
  level: number | null;
  speciesId: string | null;
  speciesName: string;
  lineageId: string | null;
  lineageName: string;
  backgroundId: string | null;
  backgroundName: string;
}

export interface AbilityOutput {
  ability: AbilityId;
  score: number | null;
  modifier: number | null;
  scoreDerivation: DerivationLine[];
  modifierDerivation: DerivationLine[];
}

export interface AbilitiesOutput {
  str: AbilityOutput;
  dex: AbilityOutput;
  con: AbilityOutput;
  int: AbilityOutput;
  wis: AbilityOutput;
  cha: AbilityOutput;
}

export interface InitiativeOutput {
  value: number | null;
  derivation: DerivationLine[];
}

export interface ArmorClassOutput {
  value: number | null;
  derivation: DerivationLine[];
}

export interface SpeedEntry {
  type: SpeedType;
  value: number;
  source: string;
}

export interface SenseEntry {
  type: SenseType;
  value: number;
  source: string;
}

export interface CombatBasicsOutput {
  proficiencyBonus: DerivedValue;
  initiative: InitiativeOutput;
  armorClass: ArmorClassOutput;
  speeds: SpeedEntry[];
  senses: SenseEntry[];
  passivePerception: DerivedValue;
}

export interface HitDiceOutput {
  die: string;
  total: number | null;
  derivation: DerivationLine[];
}

export interface DefensesOutput {
  resistances: string[];
  immunities: string[];
  conditionImmunities: string[];
}

export interface DurabilityOutput {
  hpMax: DerivedValue;
  hitDice: HitDiceOutput;
  defenses: DefensesOutput;
}

export interface SavingThrowOutput {
  ability: AbilityId;
  proficiency: ProficiencyLevel;
  totalModifier: number | null;
  derivation: DerivationLine[];
}

export interface SavingThrowsOutput {
  str: SavingThrowOutput;
  dex: SavingThrowOutput;
  con: SavingThrowOutput;
  int: SavingThrowOutput;
  wis: SavingThrowOutput;
  cha: SavingThrowOutput;
}

export interface SkillOutput {
  skill: string;
  ability: AbilityId;
  proficiency: ProficiencyLevel;
  totalModifier: number | null;
  derivation: DerivationLine[];
}

export type SkillsOutput = Record<string, SkillOutput>;

export interface ProficienciesOutput {
  armor: string[];
  weapons: string[];
  tools: string[];
  skills: string[];
}

export interface ClassAttackEntry {
  id: string;
  name: string;
  value: number | null;
  derivation: DerivationLine[];
  source: string;
}

export interface ClassSaveDcEntry {
  id: string;
  name: string;
  value: number | null;
  derivation: DerivationLine[];
  source: string;
}

export interface ClassDcAndAttackOutput {
  attackBonuses: ClassAttackEntry[];
  saveDcs: ClassSaveDcEntry[];
}

export interface AttackOutput {
  attackId: string;
  attackName: string;
  attackType: string;
  range: string;
  hitBonus: number | null;
  damage: string;
  damageType: string;
  source: string;
  derivation: DerivationLine[];
}

export interface AttacksOutput {
  entries: AttackOutput[];
}

export interface ResourceOutput {
  resourceId: string;
  resourceName: string;
  sourceType: FeatureSourceType;
  sourceId: string;
  sourceName: string;
  minLevel: number | null;
  countType: string;
  countValue: string;
  recovery: RecoveryType;
  description: string;
}

export interface ChoiceOptionOutput {
  id: string;
  label: string;
  derivedEffects: Record<string, unknown> | null;
}

export interface FeatureDerivedEffectsOutput {
  values: Record<string, unknown>;
}

export interface FeatureOutput {
  featureId: string;
  featureName: string;
  sourceType: FeatureSourceType;
  sourceId: string;
  sourceName: string;
  levelGained: number | null;
  description: string;
  derivedEffects: FeatureDerivedEffectsOutput | null;
  selectionKey: string | null;
  choiceKind: string | null;
  choiceCount: number | null;
  choicePool: string | null;
  choiceOptions: ChoiceOptionOutput[] | null;
  selections: string[];
}

export interface SpellSelectionOptionOutput {
  spellId: string;
  spellName: string;
  spellLevel: number;
  school: string;
}

export interface SpellSelectionSlotOutput {
  slotId: string;
  sourceType: SpellSelectionSourceType;
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
  options: SpellSelectionOptionOutput[];
}

export interface SpellSelectionStateOutput {
  classId: string | null;
  subclassId: string | null;
  className: string;
  subclassName: string;
  maxSpellLevel: number | null;
  knownSpellSlots: SpellSelectionSlotOutput[];
  preparedSpellSlots: SpellSelectionSlotOutput[];
  grantedSpellSlots: SpellSelectionSlotOutput[];
  allAvailableSpells: SpellSelectionOptionOutput[];
}

export interface SpellSlotLevelOutput {
  spellLevel: number;
  slotsTotal: number | null;
  source: string;
}

export interface KnownOrPreparedSpellOutput {
  spellId: string;
  spellName: string;
  sourceType: SpellSelectionSourceType;
  sourceId: string;
  sourceName: string;
  spellLevel: number | null;
  school: string;
  isAlwaysPrepared: boolean;
  countsAgainstLimit: boolean;
}

export interface SpellcastingSummaryOutput {
  spellcastingAbility: AbilityId | null;
  spellSaveDc: number | null;
  spellAttackBonus: number | null;
  preparedSpellLimit: number | null;
  spellSlotsByLevel: SpellSlotLevelOutput[];
  knownSpells: KnownOrPreparedSpellOutput[];
  preparedSpells: KnownOrPreparedSpellOutput[];
  selectionState: SpellSelectionStateOutput;
}

export interface EquipmentItemOutput {
  itemId: string;
  itemName: string;
  category: string;
  quantity: number;
  equipped: boolean;
  notes: string;
}

export interface EquipmentOutput {
  items: EquipmentItemOutput[];
}

export interface ResolvedCharacterSheet {
  identity: IdentityOutput;
  abilities: AbilitiesOutput;
  combatBasics: CombatBasicsOutput;
  durability: DurabilityOutput;
  savingThrows: SavingThrowsOutput;
  skills: SkillsOutput;
  proficiencies: ProficienciesOutput;
  languages: string[];
  classDcAndAttack: ClassDcAndAttackOutput;
  attacks: AttacksOutput;
  resources: ResourceOutput[];
  features: FeatureOutput[];
  spellSlots: SpellSelectionSlotOutput[];
  spellcasting: SpellcastingSummaryOutput;
  equipment: EquipmentOutput;
}