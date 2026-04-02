

import type { CharacterDraft } from "../engine/types";

type FeatType = "Origin" | "General" | "Epic Boon";

type FeatSlotSource =
  | "background"
  | "species"
  | "level_up"
  | "epic_boon";

export type FeatSlot = {
  slotId: string;
  label: string;
  featTypeAllowed: FeatType;
  count: 1;
  source: FeatSlotSource;
  levelGained: number;
};

type DraftWithSpecies = CharacterDraft & {
  speciesId?: string | null;
  species_id?: string | null;
};

function getSpeciesId(draft: CharacterDraft): string | null {
  const typedDraft = draft as DraftWithSpecies;
  return typedDraft.speciesId ?? typedDraft.species_id ?? null;
}

function isHuman(draft: CharacterDraft): boolean {
  return getSpeciesId(draft) === "human";
}

export function resolveFeatSlots(draft: CharacterDraft): FeatSlot[] {
  const level = draft.level ?? 1;
  const slots: FeatSlot[] = [];

  slots.push({
    slotId: "background_origin_feat",
    label: "Background Feat",
    featTypeAllowed: "Origin",
    count: 1,
    source: "background",
    levelGained: 1,
  });

  if (isHuman(draft)) {
    slots.push({
      slotId: "human_bonus_origin_feat",
      label: "Human Bonus Origin Feat",
      featTypeAllowed: "Origin",
      count: 1,
      source: "species",
      levelGained: 1,
    });
  }

  const generalFeatLevels = [4, 8, 12, 16];
  for (const featLevel of generalFeatLevels) {
    if (level >= featLevel) {
      slots.push({
        slotId: `general_feat_${featLevel}`,
        label: `Level ${featLevel} Feat`,
        featTypeAllowed: "General",
        count: 1,
        source: "level_up",
        levelGained: featLevel,
      });
    }
  }

  if (level >= 19) {
    slots.push({
      slotId: "epic_boon_19",
      label: "Level 19 Epic Boon",
      featTypeAllowed: "Epic Boon",
      count: 1,
      source: "epic_boon",
      levelGained: 19,
    });
  }

  return slots;
}