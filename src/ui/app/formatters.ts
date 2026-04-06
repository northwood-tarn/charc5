export function formatAllowedSpellLevels(levels: number[]): string {
  if (levels.length === 0) {
    return "All available levels";
  }

  if (levels.length === 1 && levels[0] === 0) {
    return "Cantrip";
  }

  const sorted = [...levels].sort((a, b) => a - b);
  const isContiguous = sorted.every((level, index) =>
    index === 0 ? true : level === sorted[index - 1] + 1
  );

  if (sorted[0] >= 1 && isContiguous) {
    return `Any spell of level ${sorted[sorted.length - 1]} or lower`;
  }

  return `Spell levels: ${sorted.join(", ")}`;
}

export function formatSpellOptionLabel(option: {
  spellName: string;
  spellLevel: number;
  school: string;
  className?: string;
  classNames?: string[];
}): string {
  const classLabel = Array.isArray(option.classNames) && option.classNames.length > 0
    ? option.classNames.join("/")
    : option.className ?? "Unknown Class";

  return `${option.spellName} (${classLabel} | ${option.school})`;
}

export function formatSkillLabel(skillId: string): string {
  return skillId
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeBackgroundAbilityOption(
  value: string | null | undefined
): "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma" | null {
  const normalized = (value ?? "").trim().toUpperCase();

  switch (normalized) {
    case "STR":
    case "STRENGTH":
      return "strength";
    case "DEX":
    case "DEXTERITY":
      return "dexterity";
    case "CON":
    case "CONSTITUTION":
      return "constitution";
    case "INT":
    case "INTELLIGENCE":
      return "intelligence";
    case "WIS":
    case "WISDOM":
      return "wisdom";
    case "CHA":
    case "CHARISMA":
      return "charisma";
    default:
      return null;
  }
}
