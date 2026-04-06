import { resolveFeatOutputs } from "./src/resolver/featResolver";
import type { CharacterDraft } from "./src/types/draft";

const draft: CharacterDraft = {
  characterName: "",
  classId: null,
  subclassId: null,
  level: 1,
  speciesId: null,
  lineageId: null,
  backgroundId: "artisan",
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
    background_origin_feat: "musician",
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

const outputs = resolveFeatOutputs(draft);
console.log(JSON.stringify(outputs, null, 2));
