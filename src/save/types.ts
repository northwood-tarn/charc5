import type { CharacterDraft } from "../types/draft";

export type CharacterSaveFile = {
  version: 1;
  savedAt: string; // ISO timestamp
  filename: string;
  draft: CharacterDraft;
};
