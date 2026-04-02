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

  // abilities
  abilities: AbilityScoresDraft;

  // feature selections (all choice systems)
  featureSelections: Record<string, string[]>;

  // skill proficiencies (future expansion)
  skillProficiencies: string[];

  // tool proficiencies (future expansion)
  toolProficiencies: string[];

  // equipment placeholders
  equipment: string[];

  // spells (future expansion)
  knownSpells: string[];
  preparedSpells: string[];
}