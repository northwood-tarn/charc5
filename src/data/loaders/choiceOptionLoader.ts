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

  // --- WEAPON POOLS ---
  if (context.weapons) {
    const weapons = context.weapons;

    if (pool === "simple_weapon_kinds") {
      return weapons
        .filter((w) => w.category === "simple")
        .map((w) => ({
          id: w.weapon_id,
          label: w.weapon_name,
          derivedEffects: null,
        }));
    }

    if (pool === "martial_weapon_kinds") {
      return weapons
        .filter((w) => w.category === "martial")
        .map((w) => ({
          id: w.weapon_id,
          label: w.weapon_name,
          derivedEffects: null,
        }));
    }

    if (pool === "simple_melee_weapon_kinds") {
      return weapons
        .filter((w) => w.category === "simple" && w.weapon_type === "melee")
        .map((w) => ({
          id: w.weapon_id,
          label: w.weapon_name,
          derivedEffects: null,
        }));
    }

    if (pool === "martial_melee_weapon_kinds") {
      return weapons
        .filter((w) => w.category === "martial" && w.weapon_type === "melee")
        .map((w) => ({
          id: w.weapon_id,
          label: w.weapon_name,
          derivedEffects: null,
        }));
    }

    if (pool === "simple_or_martial_melee_weapon_kinds") {
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
  }

  // --- SKILL POOLS ---
  if (context.skills) {
    const skills = context.skills;

    if (pool === "skills") {
      return skills.map((s) => ({
        id: s.skill_id,
        label: s.skill_name,
        derivedEffects: null,
      }));
    }

    if (pool === "barbarian_skills") {
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

    if (pool === "artisan_tools") {
      return tools
        .filter((tool) => tool.tool_type === "artisans_tools")
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