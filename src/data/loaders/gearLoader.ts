import weaponsCsv from "../csv/weapons.csv?raw";
import armorCsv from "../csv/armor.csv?raw";
import { parseCsv } from "./csvParser";

export interface WeaponRow {
  weapon_id: string;
  weapon_name: string;
  category: string;
  weapon_type: string;
  damage_dice: string;
  damage_type: string;
  mastery_trait?: string;
  master_details?: string;
}

export interface ArmorRow {
  armor_id: string;
  armor_name: string;
  category: string;
  base_ac: string;
  dex_bonus_type: string;
  dex_cap?: string;
  str_req?: string;
  stealth_disadvantage?: string;
}

export interface NormalizedWeapon {
  id: string;
  name: string;
  category: string;
  weaponType: string;
  damageDice: string;
  damageType: string;
  masteryTrait: string | null;
  masteryDetails: string | null;
}

export interface NormalizedArmor {
  id: string;
  name: string;
  category: string;
  baseAc: number | null;
  dexBonusType: string | null;
  dexCap: number | null;
  strengthRequirement: number | null;
  stealthDisadvantage: boolean;
}

export interface GearOption {
  id: string;
  name: string;
}

const weaponRows = parseCsv<WeaponRow>(weaponsCsv);
const armorRows = parseCsv<ArmorRow>(armorCsv);

function parseNullableNumber(value: string | undefined): number | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}


function parseBooleanFlag(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "1";
}

function normalizeProficiencyToken(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "");
}

function buildProficiencySet(proficiencies: string[] | undefined): Set<string> {
  return new Set((proficiencies ?? []).map((entry) => normalizeProficiencyToken(entry)));
}

function canUseWeaponCategory(proficiencySet: Set<string>, category: string): boolean {
  const normalizedCategory = normalizeProficiencyToken(category);

  if (normalizedCategory === "simple") {
    return (
      proficiencySet.has("simple") ||
      proficiencySet.has("simpleweapons") ||
      proficiencySet.has("simpleweapon")
    );
  }

  if (normalizedCategory === "martial") {
    return (
      proficiencySet.has("martial") ||
      proficiencySet.has("martialweapons") ||
      proficiencySet.has("martialweapon")
    );
  }

  return proficiencySet.has(normalizedCategory);
}

function canUseArmorCategory(proficiencySet: Set<string>, category: string): boolean {
  const normalizedCategory = normalizeProficiencyToken(category);

  const hasLight =
    proficiencySet.has("light") ||
    proficiencySet.has("lightarmor") ||
    proficiencySet.has("lightarmortraining");

  const hasMedium =
    proficiencySet.has("medium") ||
    proficiencySet.has("mediumarmor") ||
    proficiencySet.has("mediumarmortraining");

  const hasHeavy =
    proficiencySet.has("heavy") ||
    proficiencySet.has("heavyarmor") ||
    proficiencySet.has("heavyarmortraining");

  if (normalizedCategory === "light") {
    return hasLight || hasMedium || hasHeavy;
  }

  if (normalizedCategory === "medium") {
    return hasMedium || hasHeavy;
  }

  if (normalizedCategory === "heavy") {
    return hasHeavy;
  }

  if (normalizedCategory === "shield") {
    return (
      proficiencySet.has("shield") ||
      proficiencySet.has("shields") ||
      proficiencySet.has("shieldtraining")
    );
  }

  return proficiencySet.has(normalizedCategory);
}

function normalizeWeapon(row: WeaponRow): NormalizedWeapon {
  return {
    id: row.weapon_id,
    name: row.weapon_name,
    category: row.category,
    weaponType: row.weapon_type,
    damageDice: row.damage_dice,
    damageType: row.damage_type,
    masteryTrait: row.mastery_trait?.trim() || null,
    masteryDetails: row.master_details?.trim() || null,
  };
}

function normalizeArmor(row: ArmorRow): NormalizedArmor {
  return {
    id: row.armor_id,
    name: row.armor_name,
    category: row.category,
    baseAc: parseNullableNumber(row.base_ac),
    dexBonusType: row.dex_bonus_type?.trim() || null,
    dexCap: parseNullableNumber(row.dex_cap),
    strengthRequirement: parseNullableNumber(row.str_req),
    stealthDisadvantage: parseBooleanFlag(row.stealth_disadvantage),
  };
}

const normalizedWeapons = weaponRows.map(normalizeWeapon);
const normalizedArmor = armorRows.map(normalizeArmor);

export function getWeapons(): NormalizedWeapon[] {
  return normalizedWeapons;
}


export function getWeaponOptions(): GearOption[] {
  return normalizedWeapons.map((weapon) => ({
    id: weapon.id,
    name: weapon.name,
  }));
}

export function getWeaponOptionsForProficiencies(proficiencies: string[] | undefined): GearOption[] {
  const proficiencySet = buildProficiencySet(proficiencies);

  return normalizedWeapons
    .filter((weapon) => canUseWeaponCategory(proficiencySet, weapon.category))
    .map((weapon) => ({
      id: weapon.id,
      name: weapon.name,
    }));
}

export function getWeaponById(weaponId: string | null | undefined): NormalizedWeapon | null {
  if (!weaponId) {
    return null;
  }

  return normalizedWeapons.find((weapon) => weapon.id === weaponId) ?? null;
}

export function getArmor(): NormalizedArmor[] {
  return normalizedArmor;
}


export function getArmorOptions(): GearOption[] {
  return normalizedArmor
    .filter((armor) => armor.category !== "shield")
    .map((armor) => ({
      id: armor.id,
      name: armor.name,
    }));
}

export function getArmorOptionsForProficiencies(proficiencies: string[] | undefined): GearOption[] {
  const proficiencySet = buildProficiencySet(proficiencies);

  return normalizedArmor
    .filter((armor) => armor.category !== "shield")
    .filter((armor) => canUseArmorCategory(proficiencySet, armor.category))
    .map((armor) => ({
      id: armor.id,
      name: armor.name,
    }));
}

export function getArmorById(armorId: string | null | undefined): NormalizedArmor | null {
  if (!armorId) {
    return null;
  }

  return normalizedArmor.find((armor) => armor.id === armorId) ?? null;
}

export function canUseShieldFromProficiencies(proficiencies: string[] | undefined): boolean {
  const proficiencySet = buildProficiencySet(proficiencies);
  return canUseArmorCategory(proficiencySet, "shield");
}

export function getShieldOption(): NormalizedArmor | null {
  return normalizedArmor.find((armor) => armor.category === "shield") ?? null;
}