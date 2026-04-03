

import {
  getArmorById,
  getShieldOption,
  getWeaponById,
} from "../data/loaders/gearLoader";
import type { CharacterDraft } from "../types/draft";

export interface ResolvedGearWeapon {
  id: string;
  name: string;
  category: string;
  weaponType: string;
  damageDice: string;
  damageType: string;
  masteryTrait: string | null;
  masteryDetails: string | null;
}

export interface ResolvedGearArmor {
  id: string;
  name: string;
  category: string;
  baseAc: number | null;
  dexBonusType: string | null;
  dexCap: number | null;
  strengthRequirement: number | null;
  stealthDisadvantage: boolean;
}

export interface ResolvedGearShield {
  id: string;
  name: string;
  acBonus: number;
}

export interface ResolvedGearState {
  weapons: ResolvedGearWeapon[];
  armor: ResolvedGearArmor | null;
  shield: ResolvedGearShield | null;
}

function normalizeWeaponIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
  );
}

export function resolveGearState(draft: CharacterDraft): ResolvedGearState {
  const weaponIds = normalizeWeaponIds((draft as CharacterDraft & { weaponIds?: string[] }).weaponIds);
  const armorId = (draft as CharacterDraft & { armorId?: string | null }).armorId ?? null;
  const hasShield = (draft as CharacterDraft & { hasShield?: boolean }).hasShield === true;

  const weapons = weaponIds
    .slice(0, 3)
    .map((weaponId) => getWeaponById(weaponId))
    .filter((weapon): weapon is NonNullable<typeof weapon> => weapon !== null)
    .map((weapon) => ({
      id: weapon.id,
      name: weapon.name,
      category: weapon.category,
      weaponType: weapon.weaponType,
      damageDice: weapon.damageDice,
      damageType: weapon.damageType,
      masteryTrait: weapon.masteryTrait,
      masteryDetails: weapon.masteryDetails,
    }));

  const armorRecord = getArmorById(armorId);
  const armor = armorRecord
    ? {
        id: armorRecord.id,
        name: armorRecord.name,
        category: armorRecord.category,
        baseAc: armorRecord.baseAc,
        dexBonusType: armorRecord.dexBonusType,
        dexCap: armorRecord.dexCap,
        strengthRequirement: armorRecord.strengthRequirement,
        stealthDisadvantage: armorRecord.stealthDisadvantage,
      }
    : null;

  const shieldRecord = hasShield ? getShieldOption() : null;
  const shield = shieldRecord
    ? {
        id: shieldRecord.id,
        name: shieldRecord.name,
        acBonus: 2,
      }
    : null;

  return {
    weapons,
    armor,
    shield,
  };
}

export function resolveGearOutputs(draft: CharacterDraft): ResolvedGearState {
  return resolveGearState(draft);
}