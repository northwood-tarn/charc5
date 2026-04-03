import type { CharacterDraft } from "../types/draft";
import type { ResourceOutput } from "../types/sheet";

function toResourceOutput(input: {
  id: string;
  name: string;
  max: number;
  current?: number;
  recharge?: string;
  sourceName?: string;
  notes?: string;
}): ResourceOutput {
  return {
    id: input.id,
    name: input.name,
    maxUses: input.max,
    currentUses: input.current ?? input.max,
    reset:
      input.recharge === "Short Rest"
        ? "short_rest"
        : input.recharge === "Long Rest"
          ? "long_rest"
          : null,
    sourceName: input.sourceName ?? null,
    notes: input.notes ?? null,
  } as ResourceOutput;
}

function getLevel(draft: CharacterDraft): number {
  return Math.max(1, draft.level ?? 1);
}

function getCharismaScore(draft: CharacterDraft): number {
  return draft.abilities?.charisma ?? 10;
}


function getCharismaModifier(draft: CharacterDraft): number {
  return Math.floor((getCharismaScore(draft) - 10) / 2);
}

function getBardicInspirationUses(draft: CharacterDraft): number {
  return Math.max(1, getCharismaModifier(draft));
}

function getRageUses(level: number): number {
  if (level >= 17) {
    return 6;
  }
  if (level >= 12) {
    return 5;
  }
  if (level >= 6) {
    return 4;
  }
  if (level >= 3) {
    return 3;
  }
  return level >= 1 ? 2 : 0;
}

function getClericChannelDivinityUses(level: number): number {
  if (level >= 18) {
    return 3;
  }
  if (level >= 6) {
    return 2;
  }
  return level >= 2 ? 1 : 0;
}

function getPaladinChannelDivinityUses(level: number): number {
  return level >= 3 ? 1 : 0;
}

function getWildShapeUses(level: number): number {
  return level >= 2 ? 2 : 0;
}

function getLayOnHandsPool(level: number): number {
  return level * 5;
}

function getSecondWindUses(_level: number): number {
  return 1;
}

function getActionSurgeUses(level: number): number {
  return level >= 17 ? 2 : 1;
}

function getFocusPoints(level: number): number {
  return level >= 2 ? level : 0;
}

function getSorceryPoints(level: number): number {
  return level >= 2 ? level : 0;
}

function getSuperiorityDiceCount(level: number): number {
  if (level >= 15) {
    return 6;
  }
  if (level >= 7) {
    return 5;
  }
  if (level >= 3) {
    return 4;
  }
  return 0;
}

function getSuperiorityDieSize(level: number): string {
  if (level >= 18) {
    return "d12";
  }
  if (level >= 10) {
    return "d10";
  }
  return "d8";
}

export function resolveResources(draft: CharacterDraft): ResourceOutput[] {
  const classId = draft.classId ?? null;
  const subclassId = draft.subclassId ?? null;
  const level = getLevel(draft);
  const resources: ResourceOutput[] = [];

  if (classId === "barbarian" && level >= 1) {
    resources.push(
      toResourceOutput({
        id: "rage",
        name: "Rage",
        max: getRageUses(level),
        recharge: "Long Rest",
        sourceName: "Barbarian",
      })
    );
  }

  if (classId === "bard" && level >= 1) {
    resources.push(
      toResourceOutput({
        id: "bardic_inspiration",
        name: "Bardic Inspiration",
        max: getBardicInspirationUses(draft),
        recharge: level >= 5 ? "Short Rest" : "Long Rest",
        sourceName: "Bard",
      })
    );
  }

  if (classId === "cleric") {
    const uses = getClericChannelDivinityUses(level);
    if (uses > 0) {
      resources.push(
        toResourceOutput({
          id: "channel_divinity",
          name: "Channel Divinity",
          max: uses,
          recharge: "Short Rest",
          sourceName: "Cleric",
        })
      );
    }
  }

  if (classId === "paladin") {
    const uses = getPaladinChannelDivinityUses(level);
    if (uses > 0) {
      resources.push(
        toResourceOutput({
          id: "channel_divinity",
          name: "Channel Divinity",
          max: uses,
          recharge: "Short Rest",
          sourceName: "Paladin",
        })
      );
    }

    if (level >= 1) {
      resources.push(
        toResourceOutput({
          id: "lay_on_hands",
          name: "Lay on Hands",
          max: getLayOnHandsPool(level),
          recharge: "Long Rest",
          sourceName: "Paladin",
        })
      );
    }
  }

  if (classId === "druid" && level >= 2) {
    resources.push(
      toResourceOutput({
        id: "wild_shape",
        name: "Wild Shape",
        max: getWildShapeUses(level),
        recharge: "Short Rest",
        sourceName: "Druid",
      })
    );
  }

  if (classId === "fighter" && level >= 1) {
    resources.push(
      toResourceOutput({
        id: "second_wind",
        name: "Second Wind",
        max: getSecondWindUses(level),
        recharge: "Short Rest",
        sourceName: "Fighter",
      })
    );
  }

  if (classId === "fighter" && level >= 2) {
    resources.push(
      toResourceOutput({
        id: "action_surge",
        name: "Action Surge",
        max: getActionSurgeUses(level),
        recharge: "Short Rest",
        sourceName: "Fighter",
      })
    );
  }

  if (classId === "monk" && getFocusPoints(level) > 0) {
    resources.push(
      toResourceOutput({
        id: "focus_point",
        name: "Focus Points",
        max: getFocusPoints(level),
        recharge: "Short Rest",
        sourceName: "Monk",
      })
    );
  }

  if (classId === "sorcerer" && getSorceryPoints(level) > 0) {
    resources.push(
      toResourceOutput({
        id: "sorcery_points",
        name: "Sorcery Points",
        max: getSorceryPoints(level),
        recharge: "Long Rest",
        sourceName: "Sorcerer",
      })
    );
  }

  if (classId === "fighter" && subclassId === "battle_master") {
    const count = getSuperiorityDiceCount(level);
    const dieSize = getSuperiorityDieSize(level);
    if (count > 0) {
      resources.push(
        toResourceOutput({
          id: "superiority_die",
          name: "Superiority Dice",
          max: count,
          recharge: "Short Rest",
          sourceName: "Battle Master",
          notes: dieSize,
        })
      );
    }
  }

  return resources;
}
