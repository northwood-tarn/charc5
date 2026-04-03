export interface AbilityScoresDraft {
  strength: number | null;
  dexterity: number | null;
  constitution: number | null;
  intelligence: number | null;
  wisdom: number | null;
  charisma: number | null;
}

export interface CharacterDraft {
  // identity
  characterName: string;
  classId: string | null;
  subclassId: string | null;
  level: number | null;
  speciesId: string | null;
  lineageId: string | null;
  backgroundId: string | null;

  // core scores
  abilities: AbilityScoresDraft;

  // feature selections (all choice systems)
  featureSelections: Record<string, string[]>;

  // feat slot selections
  featSelections: Record<string, string | null>;

  // proficiencies and related picks
  skillProficiencies: string[];
  toolProficiencies: string[];
  languageSelections: string[];

  // gear selections
  weaponIds: string[];
  armorId: string | null;
  hasShield: boolean;
  equipment: string[];

  // spells and spell-adjacent selections
  knownSpells: string[];
  preparedSpells: string[];
  spellSelections: Record<string, string[]>;
}