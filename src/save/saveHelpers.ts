import type { CharacterDraft } from "../types/draft";
import type { CharacterSaveFile } from "./types";

type ClassEntry = { id: string; name: string };
type SubclassEntry = { id: string; name: string };

function sanitize(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "");
}

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function makeSaveFilename(
  draft: CharacterDraft,
  classes: ClassEntry[],
  subclasses: SubclassEntry[]
): string {
  const className =
    classes.find((c) => c.id === draft.classId)?.name ?? "NoClass";

  const subclassName =
    subclasses.find((s) => s.id === draft.subclassId)?.name ?? "NoSubclass";

  const name = draft.characterName || "Unnamed";
  const level = draft.level ?? 0;

  const safeName = sanitize(name);
  const safeSubclass = sanitize(subclassName);
  const safeClass = sanitize(className);

  const date = formatDateYYYYMMDD(new Date());

  return `${safeName}${safeSubclass}${safeClass}${level}_${date}`;
}

export function buildSaveFile(
  draft: CharacterDraft,
  classes: ClassEntry[],
  subclasses: SubclassEntry[]
): CharacterSaveFile {
  const filename = makeSaveFilename(draft, classes, subclasses);

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    filename,
    draft,
  };
}
