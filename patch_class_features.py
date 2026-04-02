from pathlib import Path

path = Path("/Volumes/Lacuna/Projects/charc5/src/App.tsx")
text = path.read_text()

old = '''import { lineages } from "./data/lineages";
import { species } from "./data/species";'''
new = '''import {
  getLineageOptionsForSpecies,
  getSpeciesOptions,
} from "./data/loaders/speciesLoader";
import { resolveSpeciesFeatureOutputs } from "./resolver/speciesFeatureResolver";'''
if old not in text:
    raise SystemExit("Import block not found")
text = text.replace(old, new, 1)

old = '''  const classes = getClasses();
  const subclasses = getSubclasses();
  const backgrounds = getBackgrounds();'''
new = '''  const classes = getClasses();
  const subclasses = getSubclasses();
  const backgrounds = getBackgrounds();
  const speciesOptions = getSpeciesOptions();'''
if old not in text:
    raise SystemExit("Classes/subclasses/backgrounds block not found")
text = text.replace(old, new, 1)

old = '''  const availableLineages = lineages.filter((lineage) => lineage.speciesId === safeDraft.speciesId);'''
new = '''  const availableLineages = getLineageOptionsForSpecies(safeDraft.speciesId);'''
if old not in text:
    raise SystemExit("availableLineages line not found")
text = text.replace(old, new, 1)

old = '''  const sheet = resolveCharacterSheet(safeDraft);'''
new = '''  const sheet = resolveCharacterSheet(safeDraft);
  const speciesResolvedFeatures = resolveSpeciesFeatureOutputs(safeDraft);
  const allResolvedFeatures = Array.from(
    new Map(
      [...sheet.features, ...speciesResolvedFeatures].map((feature) => [feature.featureId, feature])
    ).values()
  );'''
if old not in text:
    raise SystemExit("sheet line not found")
text = text.replace(old, new, 1)

old = '''  const choiceFeatures = sheet.features.filter((feature) => {'''
new = '''  const choiceFeatures = allResolvedFeatures.filter((feature) => {'''
if old not in text:
    raise SystemExit("choiceFeatures line not found")
text = text.replace(old, new, 1)

old = '''              {sheet.features.map((f) => {'''
new = '''              {allResolvedFeatures.map((f) => {'''
if old not in text:
    raise SystemExit("right-hand Features map not found")
text = text.replace(old, new, 1)

old = '''              {species.map((s) => ('''
new = '''              {speciesOptions.map((s) => ('''
if old not in text:
    raise SystemExit("Species dropdown map not found")
text = text.replace(old, new, 1)

path.write_text(text)
print("Updated App.tsx")