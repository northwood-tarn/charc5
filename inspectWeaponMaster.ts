import { resolveCharacterSheet } from "./src/resolver/resolveCharacterSheet";
import type { CharacterDraft } from "./src/types/draft";

const draft: CharacterDraft = {
  characterName: "Test",
  classId: null,
  subclassId: null,
  level: 4,
  speciesId: null,
  lineageId: null,
  backgroundId: null,
  abilities: {
    strength: null,
    dexterity: null,
    constitution: null,
    intelligence: null,
    wisdom: null,
    charisma: null,
  },
  featureSelections: {},
  featSelections: {
    general_feat_1: "weapon_master",
  },
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

const sheet = resolveCharacterSheet(draft);
const weaponMasterFeatures = sheet.features.filter((feature) => feature.sourceId === "weapon_master");
console.log(JSON.stringify(weaponMasterFeatures, null, 2));
