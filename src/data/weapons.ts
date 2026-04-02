

export type WeaponOption = {
  value: string;
  label: string;
  category: string;
  weaponType: string;
  damageDice: string;
  damageType: string;
  masteryTrait: string;
  masteryDetails: string;
};

let cachedWeaponOptions: WeaponOption[] | null = null;

export function getCachedWeaponOptions(): WeaponOption[] {
  return cachedWeaponOptions ?? [];
}

function parseCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];

    if (char === '"') {
      const nextChar = row[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function parseWeapons(text: string): WeaponOption[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const header = parseCsvRow(lines[0]).map((h) => h.trim());
  const idIndex = header.indexOf('weapon_id');
  const nameIndex = header.indexOf('weapon_name');
  const categoryIndex = header.indexOf('category');
  const weaponTypeIndex = header.indexOf('weapon_type');
  const damageDiceIndex = header.indexOf('damage_dice');
  const damageTypeIndex = header.indexOf('damage_type');
  const masteryTraitIndex = header.indexOf('mastery_trait');
  const masteryDetailsIndex = header.indexOf('master_details');

  if (
    idIndex === -1 ||
    nameIndex === -1 ||
    categoryIndex === -1 ||
    weaponTypeIndex === -1 ||
    damageDiceIndex === -1 ||
    damageTypeIndex === -1 ||
    masteryTraitIndex === -1 ||
    masteryDetailsIndex === -1
  ) {
    return [];
  }

  return lines.slice(1).flatMap((line) => {
    const cols = parseCsvRow(line);
    const id = cols[idIndex]?.trim();
    const name = cols[nameIndex]?.trim();
    const category = cols[categoryIndex]?.trim();
    const weaponType = cols[weaponTypeIndex]?.trim();
    const damageDice = cols[damageDiceIndex]?.trim();
    const damageType = cols[damageTypeIndex]?.trim();
    const masteryTrait = cols[masteryTraitIndex]?.trim();
    const masteryDetails = cols[masteryDetailsIndex]?.trim();

    if (
      !id ||
      !name ||
      !category ||
      !weaponType ||
      !damageDice ||
      !damageType ||
      !masteryTrait ||
      !masteryDetails
    ) {
      return [];
    }

    return [
      {
        value: id,
        label: name,
        category,
        weaponType,
        damageDice,
        damageType,
        masteryTrait,
        masteryDetails,
      },
    ];
  });
}

async function ensureLoaded(): Promise<void> {
  if (cachedWeaponOptions) return;

  const res = await fetch('/data/weapons.csv');
  if (!res.ok) {
    cachedWeaponOptions = [];
    return;
  }

  const text = await res.text();
  cachedWeaponOptions = parseWeapons(text);
}

export async function getWeaponOptions(): Promise<WeaponOption[]> {
  await ensureLoaded();
  return cachedWeaponOptions ?? [];
} 