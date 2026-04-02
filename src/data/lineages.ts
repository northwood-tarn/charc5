export interface LineageRecord {
  id: string;
  speciesId: string;
  name: string;
}

export const lineages: LineageRecord[] = [
  { id: "high_elf", speciesId: "elf", name: "High Elf" },
  { id: "wood_elf", speciesId: "elf", name: "Wood Elf" },
];