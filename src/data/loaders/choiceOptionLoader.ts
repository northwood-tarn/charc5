// Responsible ONLY for turning data-defined pools into concrete choice options.
// No hardcoded game content. All data comes from CSV or passed-in sources.


export interface ChoiceOptionOutput {
  id: string;
  label: string;
  derivedEffects: Record<string, unknown> | null;
}

export interface WeaponRow {
  weapon_id: string;
  weapon_name: string;
  category: string;
  weapon_type: string;
  mastery_trait?: string;
}

export interface SkillRow {
  skill_id: string;
  skill_name: string;
}

export interface ToolRow {
  tool_id: string;
  tool_name: string;
  tool_type?: string;
}

function normalizePoolKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[-\s]+/g, "_");
}

// --- POOL RESOLVER ---
// Takes a pool id + raw data tables and produces UI-ready options
export function resolveChoiceOptionsFromPool(
  pool: string | null,
  context: {
    weapons?: WeaponRow[];
    skills?: SkillRow[];
    tools?: ToolRow[];
  } = {}
): ChoiceOptionOutput[] {
  if (!pool) return [];

  const normalizedPool = normalizePoolKey(pool);

  // --- WEAPON POOLS ---
  if (context.weapons) {
    const weapons = context.weapons;

    if (normalizedPool === "simple_weapon_kinds") {
      return weapons
        .filter((w) => w.category === "simple")
        .map((w) => ({
          id: w.weapon_id,
          label: w.weapon_name,
          derivedEffects: null,
        }));
    }

    if (normalizedPool === "martial_weapon_kinds") {
      return weapons
        .filter((w) => w.category === "martial")
        .map((w) => ({
          id: w.weapon_id,
          label: w.weapon_name,
          derivedEffects: null,
        }));
    }

    if (normalizedPool === "simple_melee_weapon_kinds") {
      return weapons
        .filter((w) => w.category === "simple" && w.weapon_type === "melee")
        .map((w) => ({
          id: w.weapon_id,
          label: w.weapon_name,
          derivedEffects: null,
        }));
    }

    if (normalizedPool === "martial_melee_weapon_kinds") {
      return weapons
        .filter((w) => w.category === "martial" && w.weapon_type === "melee")
        .map((w) => ({
          id: w.weapon_id,
          label: w.weapon_name,
          derivedEffects: null,
        }));
    }

    if (normalizedPool === "simple_or_martial_melee_weapon_kinds") {
      return weapons
        .filter(
          (w) =>
            (w.category === "simple" || w.category === "martial") &&
            w.weapon_type === "melee"
        )
        .map((w) => ({
          id: w.weapon_id,
          label: w.weapon_name,
          derivedEffects: null,
        }));
    }

    if (
      normalizedPool === "weapons" ||
      normalizedPool === "weapon_kinds" ||
      normalizedPool === "simple_or_martial_weapon_kinds"
    ) {
      return weapons
        .filter(
          (w) => w.category === "simple" || w.category === "martial"
        )
        .map((w) => ({
          id: w.weapon_id,
          label: w.weapon_name,
          derivedEffects: null,
        }));
    }
  }

  // --- SKILL POOLS ---
  if (context.skills) {
    const skills = context.skills;

    if (normalizedPool === "skills") {
      return skills.map((s) => ({
        id: s.skill_id,
        label: s.skill_name,
        derivedEffects: null,
      }));
    }

    if (normalizedPool === "barbarian_skills") {
      const barbarianSkillIds = [
        "animal_handling",
        "athletics",
        "intimidation",
        "nature",
        "perception",
        "survival",
      ];

      return skills
        .filter((s) => barbarianSkillIds.includes(s.skill_id))
        .map((s) => ({
          id: s.skill_id,
          label: s.skill_name,
          derivedEffects: null,
        }));
    }
  }

  // --- TOOL POOLS ---
  if (context.tools) {
    const tools = context.tools;

    if (
      normalizedPool === "tools" ||
      normalizedPool === "tool_proficiencies"
    ) {
      return tools.map((tool) => ({
        id: tool.tool_id,
        label: tool.tool_name,
        derivedEffects: null,
      }));
    }

    if (
      normalizedPool === "artisan_tools" ||
      normalizedPool === "artisans_tools"
    ) {
      return tools
        .filter(
          (tool) =>
            tool.tool_type === "tool" ||
            tool.tool_type === "artisans_tools"
        )
        .map((tool) => ({
          id: tool.tool_id,
          label: tool.tool_name,
          derivedEffects: null,
        }));
    }

    if (
      normalizedPool === "musical_instruments" ||
      normalizedPool === "musical_instrument" ||
      normalizedPool === "instruments"
    ) {
      return tools
        .filter((tool) => tool.tool_type === "instrument")
        .map((tool) => ({
          id: tool.tool_id,
          label: tool.tool_name,
          derivedEffects: null,
        }));
    }
  }

  // Unknown pool → return empty (do NOT guess)
  return [];
}