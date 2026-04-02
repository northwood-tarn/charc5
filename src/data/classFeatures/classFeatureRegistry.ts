

import barbarianFeatures from "./barbarianFeatures.json";
import bardFeatures from "./bardFeatures.json";
import clericFeatures from "./clericFeatures.json";
import druidFeatures from "./druidFeatures.json";
import fighterFeatures from "./fighterFeatures.json";
import monkFeatures from "./monkFeatures.json";
import paladinFeatures from "./paladinFeatures.json";
import rangerFeatures from "./rangerFeatures.json";
import rogueFeatures from "./rogueFeatures.json";
import sorcererFeatures from "./sorcererFeatures.json";
import warlockFeatures from "./warlockFeatures.json";
import wizardFeatures from "./wizardFeatures.json";

export type ClassFeatureFile = {
  classId: string;
  className: string;
  features: unknown[];
};

const registry: Record<string, ClassFeatureFile> = {
  barbarian: barbarianFeatures as ClassFeatureFile,
  bard: bardFeatures as ClassFeatureFile,
  cleric: clericFeatures as ClassFeatureFile,
  druid: druidFeatures as ClassFeatureFile,
  fighter: fighterFeatures as ClassFeatureFile,
  monk: monkFeatures as ClassFeatureFile,
  paladin: paladinFeatures as ClassFeatureFile,
  ranger: rangerFeatures as ClassFeatureFile,
  rogue: rogueFeatures as ClassFeatureFile,
  sorcerer: sorcererFeatures as ClassFeatureFile,
  warlock: warlockFeatures as ClassFeatureFile,
  wizard: wizardFeatures as ClassFeatureFile,
};

export function getClassFeatureFile(classId: string | null): ClassFeatureFile | null {
  if (!classId) {
    return null;
  }

  return registry[classId] ?? null;
}

export function getAllClassFeatureFiles(): ClassFeatureFile[] {
  return Object.values(registry);
}