import type { CharacterSaveFile } from "./types";

const STORAGE_KEY = "charc5_saves";

function readAll(): CharacterSaveFile[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(saves: CharacterSaveFile[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
}

export function listLocalSaves(): CharacterSaveFile[] {
  return readAll();
}

export function saveToLocalStorage(save: CharacterSaveFile) {
  const saves = readAll();

  const existingIndex = saves.findIndex((s) => s.filename === save.filename);

  if (existingIndex >= 0) {
    saves[existingIndex] = save;
  } else {
    saves.push(save);
  }

  writeAll(saves);
}

export function loadFromLocalStorage(
  filename: string
): CharacterSaveFile | null {
  const saves = readAll();
  return saves.find((s) => s.filename === filename) ?? null;
}

export function deleteFromLocalStorage(filename: string) {
  const saves = readAll().filter((s) => s.filename !== filename);
  writeAll(saves);
}

export function validateSaveFile(obj: unknown): obj is CharacterSaveFile {
  if (!obj || typeof obj !== "object") return false;

  const candidate = obj as CharacterSaveFile;

  return (
    candidate.version === 1 &&
    typeof candidate.savedAt === "string" &&
    typeof candidate.filename === "string" &&
    typeof candidate.draft === "object" &&
    candidate.draft !== null
  );
}
