import classFeaturesCsv from "../csv/classFeatures.csv?raw";
import { parseCsv } from "./csvParser";

export interface SubclassOption {
  id: string;
  classId: string;
  name: string;
}

type CsvRecord = Record<string, string>;

function pickFirst(record: CsvRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function normalizeSubclassRows(rows: CsvRecord[]): SubclassOption[] {
  const subclasses = rows
    .map((row) => {
      const classId = pickFirst(row, ["class_id", "classId", "class", "parent_class_id"]);
      const subclassId = pickFirst(row, ["subclass_id", "subclassId", "subclass", "id"]);
      const subclassName = pickFirst(row, ["subclass_name", "subclassName", "subclass", "class", "name"]);
      const featureType = pickFirst(row, ["feature_type", "type", "entry_type"]);

      const looksLikeSubclassRow =
        featureType.toLowerCase() === "subclass" ||
        (classId !== "" && subclassId !== "" && subclassName !== "");

      const isCoreSubclass = subclassName.toLowerCase() === "core";

      if (!looksLikeSubclassRow || isCoreSubclass) {
        return null;
      }

      return {
        id: subclassId,
        classId,
        name: subclassName,
      } satisfies SubclassOption;
    })
    .filter((row): row is SubclassOption => row !== null);

  const seen = new Set<string>();

  return subclasses.filter((row) => {
    const key = `${row.classId}::${row.id}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

const subclassRows = parseCsv<CsvRecord>(classFeaturesCsv);

export function getSubclasses(): SubclassOption[] {
  return normalizeSubclassRows(subclassRows);
}