import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CharacterDraft } from "./types/draft";
import { resolveCharacterSheet } from "./resolver/resolveCharacterSheet";
import { resolveFeatSlots } from "./resolver/featSlotResolver";
import { getAvailableFeatsForSlot, getFeatDefinitions, resolveFeatOutputsFromIds } from "./resolver/featResolver";
import { getBackgrounds } from "./data/loaders/backgroundsLoader";
import { getClasses } from "./data/loaders/classLoader";
import {
  getLineageOptionsForSpecies,
  getSpeciesOptions,
} from "./data/loaders/speciesLoader";
import { resolveSpeciesFeatureOutputs } from "./resolver/speciesFeatureResolver";
import { getSubclasses } from "./data/loaders/subclassLoader";
import { getDefaultAbilitiesForClass } from "./data/loaders/classAbilityPriorityLoader";
import {
  canUseShieldFromProficiencies,
  getArmorOptionsForProficiencies,
  getWeaponOptionsForProficiencies,
  getWeapons,
} from "./data/loaders/gearLoader";
import { resolveChoiceOptionsFromPool } from "./data/loaders/choiceOptionLoader";
import { parseToolsCsv } from "./ui/app/parseToolsCsv";
import toolsCsv from "./data/csv/tools.csv?raw";

import "./App.css";

const initialDraft: CharacterDraft = {
  characterName: "",
  classId: null,
  subclassId: null,
  level: null,
  speciesId: null,
  lineageId: null,
  backgroundId: null,
  abilities: {
    strength: null,
    dexterity: null,
    constitution: null,
    intelligence: null,
    wisdom: null,
    charisma: null,
  },
  featureSelections: {},
  featSelections: {},
  languageSelections: [],
  weaponIds: [],
  armorId: null,
  hasShield: false,
  spellSelections: {},
  skillProficiencies: [],
  toolProficiencies: [],
  equipment: [],
  knownSpells: [],
  preparedSpells: [],
};

const abilityScoreOptions = [15, 14, 13, 12, 10, 8] as const;

const featDefinitions = getFeatDefinitions();
const featDefinitionsById = new Map(featDefinitions.map((feat) => [feat.id, feat] as const));
if (import.meta.env?.DEV) {
  const musicianDef = featDefinitionsById.get("musician");
  if (musicianDef) {
    console.log("[Musician Feat Definition]", musicianDef.effects?.toolChoices);
  }
}
const featNameOrIdToId = new Map<string, string>();
const limitedBackgroundFeatIds = new Set(["crafter", "musician", "skilled", "magic_initiate"]);
const parsedTools = parseToolsCsv(toolsCsv);
const weaponCatalog = getWeapons();

featDefinitions.forEach((feat) => {
  featNameOrIdToId.set(feat.id.toLowerCase(), feat.id);
  featNameOrIdToId.set(feat.name.toLowerCase(), feat.id);
});

function resolveFeatIdFromLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return featNameOrIdToId.get(normalized) ?? null;
}


type AbilityKey = keyof CharacterDraft["abilities"];


type RightPaneSectionKey =
  | "identity"
  | "features"
  | "classDcAndAttack"
  | "spellcasting"
  | "equipment"
  | "proficiencies"
  | "abilities"
  | "combatBasics"
  | "durability"
  | "savingThrows"
  | "skills";

type FeatOptionEntry = {
  feat_id: string;
  name: string;
  type?: string;
  notes?: string;
};

type GroupedFeatDropdownEntry =
  | { kind: "divider"; label: string }
  | { kind: "feat"; feat: FeatOptionEntry };

const initialRightPaneSections: Record<RightPaneSectionKey, boolean> = {
  identity: false,
  features: false,
  classDcAndAttack: false,
  spellcasting: false,
  equipment: false,
  proficiencies: false,
  abilities: false,
  combatBasics: false,
  durability: false,
  savingThrows: false,
  skills: false,
};



export default function App() {
  const [draft, setDraft] = useState<CharacterDraft>(initialDraft);
  const [openSections, setOpenSections] = useState<Record<RightPaneSectionKey, boolean>>(initialRightPaneSections);
  const [openFeatDropdownSlotId, setOpenFeatDropdownSlotId] = useState<string | null>(null);
  const [hoverDescription, setHoverDescription] = useState<string>("");
  const featDropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const classes = getClasses();
  const subclasses = getSubclasses();
  const backgrounds = getBackgrounds();
  const speciesOptions = getSpeciesOptions();
  const safeDraft: CharacterDraft = {
    ...initialDraft,
    ...draft,
    abilities: {
      ...initialDraft.abilities,
      ...(draft.abilities ?? {}),
    },
    featureSelections: draft.featureSelections ?? {},
    featSelections: (draft as CharacterDraft & { featSelections?: Record<string, string | null> }).featSelections ?? {},
    languageSelections: (draft as CharacterDraft & { languageSelections?: string[] }).languageSelections ?? [],
    weaponIds: (draft as CharacterDraft & { weaponIds?: string[] }).weaponIds ?? [],
    armorId: (draft as CharacterDraft & { armorId?: string | null }).armorId ?? null,
    hasShield: (draft as CharacterDraft & { hasShield?: boolean }).hasShield ?? false,
    spellSelections: (draft as CharacterDraft & { spellSelections?: Record<string, string[]> }).spellSelections ?? {},
    skillProficiencies: draft.skillProficiencies ?? [],
    toolProficiencies: draft.toolProficiencies ?? [],
    equipment: draft.equipment ?? [],
    knownSpells: draft.knownSpells ?? [],
    preparedSpells: draft.preparedSpells ?? [],
  };
  const selectedBackground =
    backgrounds.find((entry) => entry.id === safeDraft.backgroundId) ?? null;
  const backgroundFeatId = resolveFeatIdFromLabel(selectedBackground?.feat ?? null);
  const backgroundFeatDisplayName =
    backgroundFeatId
      ? featDefinitionsById.get(backgroundFeatId)?.name ?? selectedBackground?.feat ?? ""
      : selectedBackground?.feat ?? "";
  const shouldShowBackgroundFeatSlot =
    !!backgroundFeatId && limitedBackgroundFeatIds.has(backgroundFeatId);
  const backgroundFeatDefinition = backgroundFeatId ? featDefinitionsById.get(backgroundFeatId) ?? null : null;
  function setWeaponSelection(index: number, weaponId: string | null) {
    const nextWeaponIds = [...(safeDraft.weaponIds ?? [])];

    while (nextWeaponIds.length <= index) {
      nextWeaponIds.push("");
    }

    nextWeaponIds[index] = weaponId ?? "";

    while (nextWeaponIds.length > 0 && !nextWeaponIds[nextWeaponIds.length - 1]) {
      nextWeaponIds.pop();
    }

    setDraft({
      ...draft,
      weaponIds: nextWeaponIds.filter(Boolean),
    } as CharacterDraft);
  }

  function setArmorSelection(armorId: string | null) {
    setDraft({
      ...draft,
      armorId,
    } as CharacterDraft);
  }

  function setShieldSelection(hasShield: boolean) {
    setDraft({
      ...draft,
      hasShield,
    } as CharacterDraft);
  }
  const sheet = resolveCharacterSheet(safeDraft);
  if (import.meta.env?.DEV) {
    sheet.features
      .filter((feature) => feature.sourceId === "musician")
      .forEach((feature) => {
        console.log("[SheetFeature]", {
          featureId: feature.featureId,
          sourceId: feature.sourceId,
          selectionKey: feature.selectionKey,
          choiceKind: feature.choiceKind,
          choiceCount: feature.choiceCount,
          choiceOptionsLength: feature.choiceOptions?.length ?? 0,
          choicePool: feature.choicePool,
        });
      });
  }
  const speciesResolvedFeatures = resolveSpeciesFeatureOutputs(safeDraft);
  const allResolvedFeatures = Array.from(
    new Map(
      [...sheet.features, ...speciesResolvedFeatures].map((feature) => [feature.featureId, feature])
    ).values()
  );
  const sheetWithOptionalDisplayFields = sheet as typeof sheet & {
    identity: typeof sheet.identity & {
      height?: string | number | null;
      heightText?: string | null;
    };
    combatBasics: typeof sheet.combatBasics & {
      speed?: {
        value?: number | string | null;
      };
    };
  };

  const displayHeight =
    sheetWithOptionalDisplayFields.identity.heightText ??
    sheetWithOptionalDisplayFields.identity.height ??
    null;

  const displaySpeed =
    sheetWithOptionalDisplayFields.combatBasics.speed?.value ??
    null;

  const displayPerceptionModifier =
    sheet.skills.perception?.totalModifier ?? null;
  const availableWeaponOptions = getWeaponOptionsForProficiencies(sheet.proficiencies.weapons);
  const availableArmorOptions = getArmorOptionsForProficiencies(sheet.proficiencies.armor);
  const canUseShield = canUseShieldFromProficiencies(sheet.proficiencies.armor);
  const availableSubclasses = subclasses.filter((subclass) => subclass.classId === safeDraft.classId);
  const availableLineages = getLineageOptionsForSpecies(safeDraft.speciesId);
  const choiceFeatures = allResolvedFeatures.filter((feature) => {
    const isLimitedBackgroundFeat =
      feature.sourceType === "feat" &&
      feature.sourceId &&
      limitedBackgroundFeatIds.has(feature.sourceId);
    const hasChoiceCount = (feature.choiceCount ?? 0) > 0 || isLimitedBackgroundFeat;
    const hasChoiceOptions = (feature.choiceOptions?.length ?? 0) > 0;
    const hasChoicePool =
      typeof feature.choicePool === "string"
        ? feature.choicePool.length > 0
        : Array.isArray(feature.choicePool) && feature.choicePool.length > 0;
    const isSubclassChoice =
      feature.choiceKind === "subclass" ||
      feature.featureId === "subclass" ||
      feature.featureName.toLowerCase() === "subclass";

    const isBackgroundFeatWithMissingOptions =
      feature.sourceType === "feat" &&
      feature.sourceId &&
      limitedBackgroundFeatIds.has(feature.sourceId);

    return hasChoiceCount && (hasChoiceOptions || hasChoicePool || isBackgroundFeatWithMissingOptions) && !isSubclassChoice;
  });

  if (import.meta.env?.DEV) {
    const debugBackgroundFeatIds = new Set(["crafter", "musician", "skilled", "magic_initiate"]);
    choiceFeatures
      .filter((feature) => debugBackgroundFeatIds.has(feature.sourceId ?? ""))
      .forEach((feature) => {
        console.log("[ChoiceFeatures]", {
          featureId: feature.featureId,
          sourceId: feature.sourceId,
          choiceKind: feature.choiceKind,
          choiceCount: feature.choiceCount,
          selectionKey: feature.selectionKey,
        });
      });
  }
  const featSlots = resolveFeatSlots(safeDraft);
  const nonFeatChoiceFeatures = choiceFeatures.filter((feature) => feature.sourceType !== "feat");
  const featChoiceFeatures = choiceFeatures.filter((feature) => feature.sourceType === "feat");

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!openFeatDropdownSlotId) {
        return;
      }

      const currentDropdown = featDropdownRefs.current[openFeatDropdownSlotId];
      if (currentDropdown && event.target instanceof Node && currentDropdown.contains(event.target)) {
        return;
      }

      setOpenFeatDropdownSlotId(null);
      setHoverDescription("");
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [openFeatDropdownSlotId]);

  const cantripSlots = sheet.spellcasting.selectionState.knownSpellSlots.filter(
    (slot) =>
      slot.allowedSpellLevels.length === 1 && slot.allowedSpellLevels[0] === 0
  );
  const repertoireSlots = sheet.spellcasting.selectionState.knownSpellSlots.filter(
    (slot) =>
      !(slot.allowedSpellLevels.length === 1 && slot.allowedSpellLevels[0] === 0)
  );


  function formatAllowedSpellLevels(levels: number[]): string {
    if (levels.length === 0) {
      return "All available levels";
    }

    if (levels.length === 1 && levels[0] === 0) {
      return "Cantrip";
    }

    const sorted = [...levels].sort((a, b) => a - b);
    const isContiguous = sorted.every((level, index) =>
      index === 0 ? true : level === sorted[index - 1] + 1
    );

    if (sorted[0] >= 1 && isContiguous) {
      return `Any spell of level ${sorted[sorted.length - 1]} or lower`;
    }

    return `Spell levels: ${sorted.join(", ")}`;
  }


  function formatSpellOptionLabel(option: {
    spellName: string;
    spellLevel: number;
    school: string;
    className?: string;
    classNames?: string[];
  }): string {
    const classLabel = Array.isArray(option.classNames) && option.classNames.length > 0
      ? option.classNames.join("/")
      : option.className ?? "Unknown Class";

    return `${option.spellName} (${classLabel} | ${option.school})`;
  }

  function normalizeBackgroundAbilityOption(value: string | null | undefined): AbilityKey | null {
    const normalized = (value ?? "").trim().toUpperCase();

    switch (normalized) {
      case "STR":
      case "STRENGTH":
        return "strength";
      case "DEX":
      case "DEXTERITY":
        return "dexterity";
      case "CON":
      case "CONSTITUTION":
        return "constitution";
      case "INT":
      case "INTELLIGENCE":
        return "intelligence";
      case "WIS":
      case "WISDOM":
        return "wisdom";
      case "CHA":
      case "CHARISMA":
        return "charisma";
      default:
        return null;
    }
  }


  function setAbilityScore(abilityKey: AbilityKey, nextValue: number | null) {
    const currentAbilities = safeDraft.abilities;
    const previousValue = currentAbilities[abilityKey];

    const conflictingEntry = (Object.entries(currentAbilities) as [AbilityKey, number | null][]).find(
      ([key, value]) => key !== abilityKey && value === nextValue
    );

    const nextAbilities = {
      ...currentAbilities,
      [abilityKey]: nextValue,
    };

    if (conflictingEntry) {
      const [conflictingKey] = conflictingEntry;
      nextAbilities[conflictingKey] = previousValue;
    }

    setDraft({
      ...draft,
      abilities: nextAbilities,
    });
  }

  function setClassId(nextClassId: string | null) {
    setDraft({
      ...draft,
      classId: nextClassId,
      subclassId: null,
      abilities: getDefaultAbilitiesForClass(nextClassId),
    });
  }

  function setBackgroundId(nextBackgroundId: string | null) {
    const background = backgrounds.find((entry) => entry.id === nextBackgroundId) ?? null;

    const options = background?.asiOptions ?? [];
    const plusTwo = normalizeBackgroundAbilityOption(options[0] ?? null);
    const plusOne = normalizeBackgroundAbilityOption(options[1] ?? null);

    const bonuses: Partial<Record<AbilityKey, number>> = {};

    if (plusTwo) {
      bonuses[plusTwo] = 2;
    }

    if (plusOne) {
      bonuses[plusOne] = (bonuses[plusOne] ?? 0) + 1;
    }

    const currentFeatSelections =
      (safeDraft as CharacterDraft & { featSelections?: Record<string, string | null> }).featSelections ?? {};
    const nextFeatSelections = { ...currentFeatSelections };
    const backgroundFeatSelection = resolveFeatIdFromLabel(background?.feat ?? null);

    if (backgroundFeatSelection) {
      nextFeatSelections.background_origin_feat = backgroundFeatSelection;
    } else {
      delete nextFeatSelections.background_origin_feat;
    }

    setDraft({
      ...draft,
      backgroundId: nextBackgroundId,
      skillProficiencies: background ? [...background.skillProficiencies] : [],
      toolProficiencies: background && background.toolProficiency ? [background.toolProficiency] : [],
      backgroundAbilityBonuses: bonuses,
      featSelections: nextFeatSelections,
    } as CharacterDraft);
  }

  function setFeatSelection(slotId: string, featId: string | null) {
    const currentFeatSelections =
      (safeDraft as CharacterDraft & { featSelections?: Record<string, string | null> }).featSelections ?? {};

    setDraft({
      ...draft,
      featSelections: {
        ...currentFeatSelections,
        [slotId]: featId,
      },
    } as CharacterDraft);
  }

  function getSelectedFeatLabel(slotId: string, featOptions: FeatOptionEntry[]): string {
    const featSelections =
      (safeDraft as CharacterDraft & { featSelections?: Record<string, string | null> }).featSelections ?? {};
    const selectedFeatId = featSelections[slotId] ?? null;

    if (!selectedFeatId) {
      return "--";
    }

    return featOptions.find((feat) => feat.id === selectedFeatId)?.name ?? "--";
  }

  function formatSkillLabel(skillId: string): string {
    return skillId
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function renderGroupedFeatDropdown(
    slotId: string,
    groupedFeatOptions: GroupedFeatDropdownEntry[],
    featOptions: FeatOptionEntry[]
  ) {
    const featSelections =
      (safeDraft as CharacterDraft & { featSelections?: Record<string, string | null> }).featSelections ?? {};
    const selectedFeatId = featSelections[slotId] ?? "";
    const isOpen = openFeatDropdownSlotId === slotId;

    return (
      <div
        ref={(node) => {
          featDropdownRefs.current[slotId] = node;
        }}
        className="dropdown-container"
      >
        <button
          type="button"
          className="dropdown-button"
          onClick={() => {
            setOpenFeatDropdownSlotId((current) => (current === slotId ? null : slotId));
            setHoverDescription("");
          }}
        >
          {getSelectedFeatLabel(slotId, featOptions)}
        </button>

        {isOpen ? (
          <div
            className="dropdown-menu"
            onMouseLeave={() => setHoverDescription("")}
          >
            <div
              className="dropdown-item"
              onMouseEnter={() => setHoverDescription("")}
              onClick={() => {
                setFeatSelection(slotId, null);
                setOpenFeatDropdownSlotId(null);
                setHoverDescription("");
              }}
            >
              --
            </div>
            {groupedFeatOptions.map((entry, index) => {
              if (entry.kind === "divider") {
                return (
                  <div
                    key={`${slotId}:divider:${index}`}
                    className="dropdown-divider"
                  >
                    {entry.label}
                  </div>
                );
              }
              const isSelected = selectedFeatId === entry.feat.id;
              return (
                <div
                  key={entry.feat.id}
                  className={`dropdown-item${isSelected ? " selected" : ""}`}
                  onMouseEnter={() => setHoverDescription(entry.feat.notes ?? "")}
                  onClick={() => {
                    setFeatSelection(slotId, entry.feat.id);
                    setOpenFeatDropdownSlotId(null);
                    setHoverDescription("");
                  }}
                >
                  {entry.feat.name}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  function renderChoiceFeature(feature: typeof choiceFeatures[number]) {
    const selectionKey = feature.selectionKey ?? feature.featureId;
    const selections = safeDraft.featureSelections[selectionKey] ?? [];
    const knownSkillIds = new Set(Object.keys(sheet.skills));
    const proficientSkillIds = new Set(
      Object.entries(sheet.skills)
        .filter(([, value]) => value.proficiency && value.proficiency !== "none")
        .map(([skillId]) => skillId)
    );

    let options = (feature.choiceOptions ?? []).map((opt) => ({
      id: opt.id,
      label: opt.label,
    }));

    if (options.length === 0) {
      const candidatePools = new Set<string>();
      const registerPool = (pool: unknown) => {
        if (typeof pool === "string" && pool.trim().length > 0) {
          candidatePools.add(pool);
        }
      };

      if (typeof feature.choicePool === "string") {
        registerPool(feature.choicePool);
      } else if (Array.isArray(feature.choicePool)) {
        feature.choicePool.forEach((pool: unknown) => registerPool(pool));
      }

      if (feature.sourceType === "feat") {
        const featDefinition = featDefinitionsById.get(feature.sourceId);
        const effects = featDefinition?.effects;
        registerPool(effects?.toolChoices?.pool);
        registerPool(effects?.weaponMasteryChoices?.pool);
        (effects?.proficiencyChoices?.pools ?? []).forEach(registerPool);
      }

      if (candidatePools.size > 0) {
        const skillRows = Object.keys(sheet.skills).map((skillId) => ({
          skill_id: skillId,
          skill_name: formatSkillLabel(skillId),
        }));

        const derivedOptions = Array.from(candidatePools).flatMap((pool) => {
          const resolved = resolveChoiceOptionsFromPool(pool, {
            weapons: weaponCatalog.map((weapon) => ({
              weapon_id: weapon.id,
              weapon_name: weapon.name,
              category: weapon.category,
              weapon_type: weapon.weaponType,
              mastery_trait: weapon.masteryTrait ?? undefined,
              master_details: weapon.masteryDetails ?? undefined,
            })),
            skills: skillRows,
            tools: parsedTools,
          });

          return resolved.map((option) => ({
            id: option.id,
            label: option.label,
          }));
        });

        if (derivedOptions.length > 0) {
          options = Array.from(new Map(derivedOptions.map((option) => [option.id, option])).values());
        }
      }

      if (options.length === 0 && candidatePools.size > 0) {
        return (
          <div key={feature.featureId} className="field-row-top">
            <label className="field-label">{feature.featureName}</label>
            <div className="app-column">
              <div className="section-helper">
                Choose {feature.choiceCount ?? 0}
              </div>
              <div className="section-helper">
                No resolved options for pool: {Array.from(candidatePools).join(", ")}
              </div>
            </div>
          </div>
        );
      }
    }

    if (feature.choiceKind === "proficiency_choice") {
      options = options.filter((option) => {
        if (!knownSkillIds.has(option.id)) {
          return true;
        }

        if (selections.includes(option.id)) {
          return true;
        }

        return !proficientSkillIds.has(option.id);
      });
    }

    if (feature.choiceKind === "expertise_choice") {
      options = Array.from(
        new Set([
          ...Array.from(proficientSkillIds),
          ...selections,
        ])
      )
        .map((skillId) => {
          const existingOption = (feature.choiceOptions ?? []).find((option) => option.id === skillId);
          return {
            id: skillId,
            label: existingOption?.label ?? formatSkillLabel(skillId),
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    selections.forEach((selection) => {
      if (options.some((option) => option.id === selection)) {
        return;
      }

      options.push({
        id: selection,
        label: formatSkillLabel(selection),
      });
    });

    const limitedFeatFallbackCount =
      feature.sourceId && limitedBackgroundFeatIds.has(feature.sourceId)
        ? featDefinitionsById.get(feature.sourceId)?.effects?.toolChoices?.count ??
          featDefinitionsById.get(feature.sourceId)?.effects?.proficiencyChoices?.count ??
          featDefinitionsById.get(feature.sourceId)?.effects?.expertiseChoices?.count ??
          null
        : null;
    const count = feature.choiceCount ?? limitedFeatFallbackCount ?? 0;
    const isSingleChoice = count === 1;
    const isWeaponMasteryChoice = feature.choiceKind === "weapon_mastery";
    const isMusicianToolChoice =
      feature.sourceId === "musician" &&
      (feature.choiceKind === "tool_proficiency" ||
        (feature.featureName ?? "").toLowerCase().includes("tool"));
    const isCrafterToolChoice =
      feature.sourceId === "crafter" &&
      (feature.choiceKind === "tool_proficiency" ||
        (feature.featureName ?? "").toLowerCase().includes("tool"));
    const useCompactChoiceBox = isWeaponMasteryChoice || options.length > 6;
    const otherWeaponMasterySelections = isWeaponMasteryChoice
      ? Array.from(
          new Set(
            choiceFeatures
              .filter(
                (candidate) =>
                  candidate.choiceKind === "weapon_mastery" &&
                  candidate.featureId !== feature.featureId
              )
              .flatMap((candidate) => {
                const candidateSelectionKey = candidate.selectionKey ?? candidate.featureId;
                return safeDraft.featureSelections[candidateSelectionKey] ?? [];
              })
          )
        )
      : [];

    if (isMusicianToolChoice || isCrafterToolChoice) {
      const slotCount = count > 0 ? count : 3;
      const slotAssignmentsKey = `${selectionKey}__slot_assignments`;

      const assignedSlots =
        (safeDraft.featureSelections[slotAssignmentsKey] as string[] | undefined) ??
        [...selections];

      const paddedAssignments = [...assignedSlots];

      while (paddedAssignments.length < slotCount) {
        paddedAssignments.push("");
      }

      const musicianOptions = parsedTools
        .filter((tool) => tool.tool_type === "instrument")
        .map((tool) => ({
          id: tool.tool_id,
          label: tool.tool_name,
        }));

      const crafterOptions = parsedTools
        .filter((tool) => {
          const normalized = (tool.tool_type ?? "").toLowerCase();
          return (
            normalized === "tool" ||
            normalized === "artisan_tools" ||
            normalized === "artisans_tools" ||
            normalized === "artisan's_tools" ||
            normalized === "artisan" ||
            normalized === "kit" ||
            normalized === "crafting"
          );
        })
        .map((tool) => ({
          id: tool.tool_id,
          label: tool.tool_name,
        }));

      const defaultOptions = options.map((option) => ({
        id: option.id,
        label: option.label,
      }));

      const availableOptions = isMusicianToolChoice
        ? musicianOptions.length > 0
          ? musicianOptions
          : defaultOptions
        : crafterOptions.length > 0
          ? crafterOptions
          : defaultOptions;

      const slotLabel = isMusicianToolChoice ? "Instrument" : "Tool";

      function updateMusicianSelection(slotIndex: number, nextValue: string) {
        setDraft((currentDraft) => {
          const previousSelections =
            (currentDraft as CharacterDraft & { featureSelections?: Record<string, string[] | undefined> })
              .featureSelections ?? {};

          const currentAssignments = [...((previousSelections[slotAssignmentsKey] as string[] | undefined) ?? [])];
          while (currentAssignments.length < slotCount) {
            currentAssignments.push("");
          }

          currentAssignments[slotIndex] = nextValue;

          const deduped = currentAssignments.map((value, index) => {
            if (!value) {
              return "";
            }

            const firstIndex = currentAssignments.findIndex((entry) => entry === value);
            return firstIndex === index ? value : "";
          });

          const finalAssignments = deduped.slice(0, slotCount);
          const finalSelections = finalAssignments.filter(Boolean);

          return {
            ...currentDraft,
            featureSelections: {
              ...previousSelections,
              [selectionKey]: finalSelections,
              [slotAssignmentsKey]: finalAssignments,
            },
          } as CharacterDraft;
        });
      }

      return (
        <div key={feature.featureId} className="field-row-top">
          <label className="field-label">{feature.featureName}</label>
          <div className="app-column">
            <div className="section-helper">Choose {slotCount}</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "12px",
                width: "100%",
              }}
            >
              {Array.from({ length: slotCount }).map((_, slotIndex) => (
                <div key={`${feature.featureId}:slot:${slotIndex}`} className="field-column">
                  <div className="section-helper" style={{ fontSize: "12px", marginBottom: "4px" }}>
                    {slotLabel} {slotIndex + 1}
                  </div>
                  <select
                    className="field-select"
                    value={paddedAssignments[slotIndex] ?? ""}
                    onChange={(e) => updateMusicianSelection(slotIndex, e.target.value)}
                  >
                    <option value="">--</option>
                    {availableOptions.map((option) => {
                      const alreadyChosenIndex = paddedAssignments.findIndex((entry) => entry === option.id);
                      const isTakenByOtherSlot =
                        alreadyChosenIndex !== -1 && alreadyChosenIndex !== slotIndex;

                      return (
                        <option key={option.id} value={option.id} disabled={isTakenByOtherSlot}>
                          {option.label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (isWeaponMasteryChoice && feature.sourceId === "weapon_master") {
      const sortedWeapons = [...weaponCatalog].sort((a, b) => a.name.localeCompare(b.name));
      const currentSelection = selections[0] ?? "";

      return (
        <div key={feature.featureId} className="field-row-top">
          <label className="field-label">{feature.featureName}</label>
          <div className="app-column">
            <div className="section-helper">Choose 1 weapon for mastery</div>
            <select
              className="field-select"
              value={currentSelection}
              onChange={(e) => {
                const nextValue = e.target.value;
                setDraft((currentDraft) => {
                  const previousSelections =
                    (currentDraft as CharacterDraft & {
                      featureSelections?: Record<string, string[] | undefined>;
                    }).featureSelections ?? {};

                  return {
                    ...currentDraft,
                    featureSelections: {
                      ...previousSelections,
                      [selectionKey]: nextValue ? [nextValue] : [],
                    },
                  } as CharacterDraft;
                });
              }}
            >
              <option value="">--</option>
              {sortedWeapons.map((weapon) => (
                <option key={weapon.id} value={weapon.id}>
                  {weapon.name}
                  {weapon.masteryTrait ? ` — ${weapon.masteryTrait}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    return (
      <div key={feature.featureId} className="field-row-top">
        <label className="field-label">{feature.featureName}</label>
        <div className="app-column">
          <div className="section-helper">
            Choose {count}
          </div>
          {useCompactChoiceBox ? (
            <div className="choice-box">
              {options.map((option) => {
                const isChecked = selections.includes(option.id);
                const isTakenByOtherWeaponMastery =
                  isWeaponMasteryChoice && otherWeaponMasterySelections.includes(option.id);
                const disableUnchecked =
                  isTakenByOtherWeaponMastery ||
                  (!isSingleChoice && !isChecked && selections.length >= count);

                return (
                  <label key={option.id}>
                    <input
                      type={isSingleChoice ? "radio" : "checkbox"}
                      name={selectionKey}
                      checked={isChecked}
                      disabled={disableUnchecked}
                      onChange={(e) => {
                        const nextSelections = (() => {
                          if (isSingleChoice) {
                            return e.target.checked ? [option.id] : [];
                          }

                          return e.target.checked
                            ? [...selections, option.id]
                            : selections.filter((selectedId) => selectedId !== option.id);
                        })();

                        setDraft((currentDraft) => {
                          const previousSelections =
                            (currentDraft as CharacterDraft & {
                              featureSelections?: Record<string, string[] | undefined>;
                            }).featureSelections ?? {};

                          return {
                            ...currentDraft,
                            featureSelections: {
                              ...previousSelections,
                              [selectionKey]: nextSelections,
                            },
                          } as CharacterDraft;
                        });
                      }}
                    />{" "}
                    {isWeaponMasteryChoice && otherWeaponMasterySelections.includes(option.id)
                      ? `✓ ${option.label}`
                      : option.label}
                  </label>
                );
              })}
            </div>
          ) : (
            options.map((option) => {
              const isChecked = selections.includes(option.id);
              const isTakenByOtherWeaponMastery =
                isWeaponMasteryChoice && otherWeaponMasterySelections.includes(option.id);
              const disableUnchecked =
                isTakenByOtherWeaponMastery ||
                (!isSingleChoice && !selections.includes(option.id) && selections.length >= count);

              return (
                <label key={option.id}>
                  <input
                    type={isSingleChoice ? "radio" : "checkbox"}
                    name={selectionKey}
                    checked={isChecked}
                    disabled={disableUnchecked}
                    onChange={(e) => {
                      const nextSelections = (() => {
                        if (isSingleChoice) {
                          return e.target.checked ? [option.id] : [];
                        }

                        return e.target.checked
                          ? [...selections, option.id]
                          : selections.filter((w) => w !== option.id);
                      })();

                      setDraft((currentDraft) => {
                        const previousSelections =
                          (currentDraft as CharacterDraft & {
                            featureSelections?: Record<string, string[] | undefined>;
                          }).featureSelections ?? {};

                        return {
                          ...currentDraft,
                          featureSelections: {
                            ...previousSelections,
                            [selectionKey]: nextSelections,
                          },
                        } as CharacterDraft;
                      });
                    }}
                  />{" "}
                  {isWeaponMasteryChoice && otherWeaponMasterySelections.includes(option.id)
                    ? `✓ ${option.label}`
                    : option.label}
                </label>
              );
            })
          )}
        </div>
      </div>
    );
  }


  function setSpellSelection(
    bucket: "known" | "prepared",
    index: number,
    nextSpellId: string | null
  ) {
    const current = bucket === "known"
      ? [...safeDraft.knownSpells]
      : [...safeDraft.preparedSpells];

    while (current.length <= index) {
      current.push("");
    }

    current[index] = nextSpellId ?? "";

    while (current.length > 0 && !current[current.length - 1]) {
      current.pop();
    }

    if (bucket === "known") {
      setDraft({
        ...draft,
        knownSpells: current.filter(Boolean),
      });
      return;
    }

    setDraft({
      ...draft,
      preparedSpells: current.filter(Boolean),
    });
  }

  const renderRightPaneSection = (
    key: RightPaneSectionKey,
    title: string,
    content: ReactNode,
    options?: { marginBottom?: string; textTransform?: CSSProperties["textTransform"] }
  ) => {
    const isOpen = openSections[key];

    return (
      <div style={{ marginBottom: options?.marginBottom ?? "16px" }}>
        <button
          type="button"
          className="section-toggle"
          onClick={() =>
            setOpenSections((prev) => ({
              ...prev,
              [key]: !prev[key],
            }))
          }
          style={{ textTransform: options?.textTransform }}
        >
          {isOpen ? "▾ " : "▸ "}
          {title}
        </button>
        {isOpen ? <div className="section-content">{content}</div> : null}
      </div>
    );
  };

  return (
  <div className="app-root">
    {/* LEFT */}
    <div className="app-left">
      <h2 className="app-section-title">Inputs</h2>
      <div className="app-grid">
        <div className="app-column">
          <div className="field-row">
            <label className="field-label">Name</label>
            <input
              className="field-input"
              value={safeDraft.characterName}
              onChange={(e) =>
                setDraft({ ...draft, characterName: e.target.value })
              }
            />
          </div>

          <div className="field-row">
            <label className="field-label">Class</label>
            <select
              className="field-select"
              value={safeDraft.classId ?? ""}
              onChange={(e) => setClassId(e.target.value || null)}
            >
              <option value="">--</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <label className="field-label">Subclass</label>
            <select
              className="field-select"
              value={safeDraft.subclassId ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, subclassId: e.target.value || null })
              }
            >
              <option value="">--</option>
              {availableSubclasses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <label className="field-label">Level</label>
            <input
              className="field-input"
              type="number"
              value={safeDraft.level ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  level: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>

          {nonFeatChoiceFeatures.map((feature) => renderChoiceFeature(feature))}

          {/* FEAT SLOTS */}
          {featSlots.map((slot) => {
            let featOptions = getAvailableFeatsForSlot(safeDraft, slot.slotId);
            const featSelections =
              (safeDraft as CharacterDraft & { featSelections?: Record<string, string | null> }).featSelections ?? {};
            let selectedFeatId = featSelections[slot.slotId] ?? "";
            const takenFeatIds = new Set(
              Object.entries(featSelections)
                .filter(([otherSlotId, featId]) => otherSlotId !== slot.slotId && typeof featId === "string" && featId)
                .map(([, featId]) => featId as string)
            );
            const isBackgroundSlot = slot.slotId === "background_origin_feat";
            if (isBackgroundSlot && !selectedFeatId && backgroundFeatId) {
              selectedFeatId = backgroundFeatId;
            }
            let selectedFeatChoiceFeatures = selectedFeatId
              ? featChoiceFeatures.filter((feature) => {
                  const matchesParent = feature.parentFeatureId === selectedFeatId;
                  const matchesSource = feature.sourceId === selectedFeatId;
                  const matchesFeature = feature.featureId === selectedFeatId;

                  const isChoiceFeature =
                    feature.selectionKey !== slot.slotId && feature.choiceKind && (feature.choiceCount ?? 0) >= 0;

                  return (matchesParent || matchesSource || matchesFeature) && isChoiceFeature;
                })
              : [];

            if (
              isBackgroundSlot &&
              selectedFeatChoiceFeatures.length === 0 &&
              selectedFeatId &&
              limitedBackgroundFeatIds.has(selectedFeatId)
            ) {
              const fallbackFeatures = resolveFeatOutputsFromIds([selectedFeatId], safeDraft).filter((feature) => {
                const hasChoiceCount = (feature.choiceCount ?? 0) > 0;
                const hasChoiceOptions = (feature.choiceOptions?.length ?? 0) > 0;
                const hasChoicePool =
                  typeof feature.choicePool === "string"
                    ? feature.choicePool.length > 0
                    : Array.isArray(feature.choicePool) && feature.choicePool.length > 0;

                return feature.sourceType === "feat" && hasChoiceCount && (hasChoiceOptions || hasChoicePool);
              });

              if (import.meta.env?.DEV) {
                console.log("[BackgroundFeatSlot] fallback features", {
                  slotId: slot.slotId,
                  selectedFeatId,
                  fallbackCount: fallbackFeatures.length,
                  fallbackIds: fallbackFeatures.map((feature) => feature.featureId),
                });
              }

              selectedFeatChoiceFeatures = fallbackFeatures.map((feature) => {
                const remap = (value: string | null) => {
                  if (!value) {
                    return value;
                  }

                  return value.replace(/^legacy_feat_\d+/i, slot.slotId);
                };

                const nextFeatureId = remap(feature.featureId) ?? feature.featureId;
                const nextSelectionKey = remap(feature.selectionKey) ?? feature.selectionKey;
                const nextParentFeatureId = remap(feature.parentFeatureId);

                return {
                  ...feature,
                  featureId: nextFeatureId,
                  selectionKey: nextSelectionKey,
                  parentFeatureId: nextParentFeatureId,
                };
              });
            }

            if (
              selectedFeatId === "weapon_master" &&
              !selectedFeatChoiceFeatures.some((feature) => feature.choiceKind === "weapon_mastery")
            ) {
              const fallbackFeatures = resolveFeatOutputsFromIds([selectedFeatId], safeDraft).filter(
                (feature) => feature.choiceKind === "weapon_mastery"
              );

              if (fallbackFeatures.length > 0) {
                const remap = (value: string | null) => {
                  if (!value) {
                    return value;
                  }

                  return value.replace(/^legacy_feat_\d+/i, slot.slotId);
                };

                const remapped = fallbackFeatures.map((feature) => {
                  const nextFeatureId = remap(feature.featureId) ?? feature.featureId;
                  const nextSelectionKey = remap(feature.selectionKey) ?? feature.selectionKey;
                  const nextParentFeatureId = remap(feature.parentFeatureId);

                  return {
                    ...feature,
                    featureId: nextFeatureId,
                    selectionKey: nextSelectionKey,
                    parentFeatureId: nextParentFeatureId,
                  };
                });

                selectedFeatChoiceFeatures = [...selectedFeatChoiceFeatures, ...remapped];
              }
            }

            if (selectedFeatChoiceFeatures.length > 1) {
              const deduped = new Map<string, (typeof selectedFeatChoiceFeatures)[number]>();
              selectedFeatChoiceFeatures.forEach((feature) => {
                const key = feature.selectionKey ?? feature.featureId;
                if (!deduped.has(key)) {
                  deduped.set(key, feature);
                }
              });
              selectedFeatChoiceFeatures = Array.from(deduped.values());
            }

            if (
              selectedFeatChoiceFeatures.length === 0 &&
              selectedFeatId &&
              limitedBackgroundFeatIds.has(selectedFeatId)
            ) {
              console.log("[BackgroundFeatSlot] Missing choice features after filtering", {
                slotId: slot.slotId,
                selectedFeatId,
              });
            }

            if (isBackgroundSlot && import.meta.env?.DEV) {
              console.log("[BackgroundFeatSlot]", {
                slotId: slot.slotId,
                backgroundFeatId,
                selectedFeatId,
                choiceFeatureCount: selectedFeatChoiceFeatures.length,
                choiceFeatureIds: selectedFeatChoiceFeatures.map((feature) => feature.featureId),
              });
            }

            if (isBackgroundSlot) {
              if (!shouldShowBackgroundFeatSlot) {
                return null;
              }

              const backgroundFeatControls =
                selectedFeatChoiceFeatures.length > 0 ? (
                  <div className="app-column">
                    {selectedFeatChoiceFeatures.map((feature) => renderChoiceFeature(feature))}
                  </div>
                ) : null;

              return (
                <div key={slot.slotId} className="app-column">
                  <div className="field-row">
                    <label className="field-label">
                      {slot.label} (Background)
                    </label>
                    <div className="dropdown-button disabled">
                      {backgroundFeatDisplayName || "--"}
                    </div>
                  </div>
                  {backgroundFeatControls}
                </div>
              );
            }

            const groupedFeatOptions = ["Origin", "General", "Epic Boon"].flatMap((featType) => {
              const normalizedTargetType = featType.toLowerCase();
              const matchingFeats = featOptions
                .filter((feat) => (feat.type ?? "").toLowerCase() === normalizedTargetType)
                .sort((a, b) => a.name.localeCompare(b.name));

                  if (matchingFeats.length === 0) {
                    return [] as Array<
                      | { kind: "divider"; label: string }
                      | { kind: "feat"; feat: (typeof featOptions)[number] }
                    >;
                  }

                  return [
                    {
                      kind: "divider" as const,
                      label:
                        featType === "Origin"
                          ? "--Origin Feats--"
                          : featType === "General"
                            ? "--General Feats--"
                            : "--Epic Boon Feats--",
                    },
                    ...matchingFeats.map((feat) => ({ kind: "feat" as const, feat })),
                  ];
                });

            return (
              <div key={slot.slotId} className="app-column">
                <div className="field-row">
                  <label className="field-label">
                    {slot.label}
                  </label>
                  {renderGroupedFeatDropdown(
                    slot.slotId,
                    groupedFeatOptions.map((entry) =>
                      entry.kind === "feat"
                        ? {
                            kind: "feat" as const,
                            feat: {
                              ...entry.feat,
                              name: takenFeatIds.has(entry.feat.id)
                                ? `✓ ${entry.feat.name}`
                                : entry.feat.name,
                            },
                          }
                        : entry
                    ),
                    featOptions
                  )}
                </div>
                {selectedFeatChoiceFeatures.length > 0 && (
                  <div className="app-column">
                    {selectedFeatChoiceFeatures.map((feature) => renderChoiceFeature(feature))}
                  </div>
                )}
              </div>
            );
          })}
          {sheet.spellcasting.selectionState.knownSpellSlots.length > 0 && (
            <div className="app-column">
              <div className="section-subtitle">
                Spell Repertoire
              </div>
              <div className="section-helper">
                Cantrips: {cantripSlots.length} · Spells in repertoire: {repertoireSlots.length}
              </div>

              {cantripSlots.length > 0 && (
                <div className="app-column">
                  <div className="section-subtitle-tight">
                    Cantrips
                  </div>
                  {cantripSlots.map((slot, index) => (
                    <div key={slot.slotId} className="field-row">
                      <label className="field-label">{`Cantrip ${index + 1}`}</label>
                      <div className="app-column">
                        <div className="section-helper">
                          {formatAllowedSpellLevels(slot.allowedSpellLevels)}
                          {slot.allowedSchools.length > 0
                            ? ` · Schools: ${slot.allowedSchools.join(", ")}`
                            : ""}
                        </div>
                        <select
                          className="field-select"
                          value={slot.selectedSpellId ?? ""}
                          onChange={(e) =>
                            setSpellSelection(
                              "known",
                              index,
                              e.target.value || null
                            )
                          }
                        >
                          <option value="">--</option>
                          {slot.options.map((option, optionIndex) => (
                            <option
                              key={`${slot.slotId}:${option.spellId}:${optionIndex}`}
                              value={option.spellId}
                            >
                              {formatSpellOptionLabel(option)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {repertoireSlots.length > 0 && (
                <div className="app-column">
                  <div className="section-subtitle-tight">
                    Spells in Repertoire
                  </div>
                  {repertoireSlots.map((slot, index) => (
                    <div key={slot.slotId} className="field-row">
                      <label className="field-label">{`Spell ${index + 1}`}</label>
                      <div className="app-column">
                        <div className="section-helper">
                          {formatAllowedSpellLevels(slot.allowedSpellLevels)}
                          {slot.allowedSchools.length > 0
                            ? ` · Schools: ${slot.allowedSchools.join(", ")}`
                            : ""}
                        </div>
                        <select
                          className="field-select"
                          value={slot.selectedSpellId ?? ""}
                          onChange={(e) =>
                            setSpellSelection(
                              "known",
                              cantripSlots.length + index,
                              e.target.value || null
                            )
                          }
                        >
                          <option value="">--</option>
                          {slot.options.map((option, optionIndex) => (
                            <option
                              key={`${slot.slotId}:${option.spellId}:${optionIndex}`}
                              value={option.spellId}
                            >
                              {formatSpellOptionLabel(option)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {sheet.spellcasting.selectionState.preparedSpellSlots.length > 0 && (
            <div className="app-column">
              <div className="section-subtitle">
                Prepared Spells
              </div>
              {sheet.spellcasting.selectionState.preparedSpellSlots.map((slot, index) => (
                <div key={slot.slotId} className="field-row">
                  <label className="field-label">{slot.sourceName}</label>
                  <div className="app-column">
                    <div className="section-helper">
                      {slot.allowedSpellLevels.length > 0
                        ? `Levels: ${slot.allowedSpellLevels.join(", ")}`
                        : "All available levels"}
                      {slot.allowedSchools.length > 0
                        ? ` · Schools: ${slot.allowedSchools.join(", ")}`
                        : ""}
                    </div>
                    <select
                      className="field-select"
                      value={slot.selectedSpellId ?? ""}
                      onChange={(e) =>
                        setSpellSelection(
                          "prepared",
                          index,
                          e.target.value || null
                        )
                      }
                    >
                      <option value="">--</option>
                      {slot.options.map((option, optionIndex) => (
                        <option
                          key={`${slot.slotId}:${option.spellId}:${optionIndex}`}
                          value={option.spellId}
                        >
                          {formatSpellOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sheet.spellcasting.selectionState.grantedSpellSlots.length > 0 && (
            <div className="app-column">
              <div className="section-subtitle">
                Granted Spells
              </div>
              {sheet.spellcasting.selectionState.grantedSpellSlots.map((slot) => (
                <div key={slot.slotId} className="field-row">
                  <label className="field-label">{slot.sourceName}</label>
                  <div style={{ fontSize: "13px" }}>
                    {slot.fixedSpellId ?? slot.selectedSpellId ?? "Unselected granted slot"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="app-column">
          <div className="ability-section">
            <div className="section-title-small">
              Abilities
            </div>

            <div className="field-row">
              <label className="field-label">STR</label>
              <select
                className="field-select"
                value={safeDraft.abilities.strength ?? ""}
                onChange={(e) =>
                  setAbilityScore(
                    "strength",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">--</option>
                {abilityScoreOptions.map((score) => (
                  <option key={score} value={score}>
                    {score}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <label className="field-label">DEX</label>
              <select
                className="field-select"
                value={safeDraft.abilities.dexterity ?? ""}
                onChange={(e) =>
                  setAbilityScore(
                    "dexterity",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">--</option>
                {abilityScoreOptions.map((score) => (
                  <option key={score} value={score}>
                    {score}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <label className="field-label">CON</label>
              <select
                className="field-select"
                value={safeDraft.abilities.constitution ?? ""}
                onChange={(e) =>
                  setAbilityScore(
                    "constitution",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">--</option>
                {abilityScoreOptions.map((score) => (
                  <option key={score} value={score}>
                    {score}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <label className="field-label">INT</label>
              <select
                className="field-select"
                value={safeDraft.abilities.intelligence ?? ""}
                onChange={(e) =>
                  setAbilityScore(
                    "intelligence",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">--</option>
                {abilityScoreOptions.map((score) => (
                  <option key={score} value={score}>
                    {score}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <label className="field-label">WIS</label>
              <select
                className="field-select"
                value={safeDraft.abilities.wisdom ?? ""}
                onChange={(e) =>
                  setAbilityScore(
                    "wisdom",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">--</option>
                {abilityScoreOptions.map((score) => (
                  <option key={score} value={score}>
                    {score}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <label className="field-label">CHA</label>
              <select
                className="field-select"
                value={safeDraft.abilities.charisma ?? ""}
                onChange={(e) =>
                  setAbilityScore(
                    "charisma",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">--</option>
                {abilityScoreOptions.map((score) => (
                  <option key={score} value={score}>
                    {score}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row">
            <label className="field-label">Species</label>
            <select
              className="field-select"
              value={safeDraft.speciesId ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  speciesId: e.target.value || null,
                  lineageId: null,
                })
              }
            >
              <option value="">--</option>
              {speciesOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <label className="field-label">Lineage</label>
            <select
              className="field-select"
              value={safeDraft.lineageId ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, lineageId: e.target.value || null })
              }
            >
              <option value="">--</option>
              {availableLineages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <label className="field-label">Background</label>
            <select
              className="field-select"
              value={safeDraft.backgroundId ?? ""}
              onChange={(e) => setBackgroundId(e.target.value || null)}
            >
              <option value="">--</option>
              {backgrounds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ability-section" style={{ marginTop: "8px" }}>
            <div className="section-title-small">
              Gear
            </div>

            {[0, 1, 2].map((index) => (
              <div key={`weapon-${index}`} className="field-row">
                <label className="field-label">{`Weapon ${index + 1}`}</label>
                <select
                  className="field-select"
                  value={safeDraft.weaponIds[index] ?? ""}
                  onChange={(e) => setWeaponSelection(index, e.target.value || null)}
                >
                  <option value="">--</option>
                  {availableWeaponOptions.map((weapon) => (
                    <option key={weapon.id} value={weapon.id}>
                      {weapon.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            <div className="field-row">
              <label className="field-label">Armor</label>
              <select
                className="field-select"
                value={safeDraft.armorId ?? ""}
                onChange={(e) => setArmorSelection(e.target.value || null)}
              >
                <option value="">--</option>
                {availableArmorOptions.map((armor) => (
                  <option key={armor.id} value={armor.id}>
                    {armor.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <label className="field-label">Shield</label>
              <input
                type="checkbox"
                checked={safeDraft.hasShield}
                disabled={!canUseShield}
                onChange={(e) => setShieldSelection(e.target.checked)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* RIGHT */}
    <div className="app-right">
      <h2 className="app-section-title">
        Resolved Sheet
      </h2>
      <div className="right-grid">
        <div>
          {renderRightPaneSection(
            "identity",
            "Identity",
            <div style={{ paddingLeft: "12px" }}>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">Character name: </span>
                <span className="value-strong">{sheet.identity.characterName || ""}</span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">classId: </span>
                <span className="value-strong">{sheet.identity.classId ?? "null"}</span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">className: </span>
                <span className="value-strong">{sheet.identity.className || ""}</span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">subclassId: </span>
                <span className="value-strong">{sheet.identity.subclassId ?? "null"}</span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">subclassName: </span>
                <span className="value-strong">{sheet.identity.subclassName || ""}</span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">level: </span>
                <span className="value-strong">{sheet.identity.level ?? "null"}</span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">speciesId: </span>
                <span className="value-strong">{sheet.identity.speciesId ?? "null"}</span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">speciesName: </span>
                <span className="value-strong">{sheet.identity.speciesName || ""}</span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">lineageId: </span>
                <span className="value-strong">{sheet.identity.lineageId ?? "null"}</span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">lineageName: </span>
                <span className="value-strong">{sheet.identity.lineageName || ""}</span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">backgroundId: </span>
                <span className="value-strong">{sheet.identity.backgroundId ?? "null"}</span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">backgroundName: </span>
                <span className="value-strong">{sheet.identity.backgroundName || ""}</span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">height: </span>
                <span className="value-strong">{displayHeight ?? "null"}</span>
              </div>
            </div>,
            { textTransform: "capitalize" }
          )}
          {renderRightPaneSection(
            "features",
            "Features",
            <div style={{ paddingLeft: "12px", textAlign: "left" }}>
              {allResolvedFeatures.map((f) => {
                const featureSelectionKey = f.selectionKey ?? f.featureId;
                const draftSelections = safeDraft.featureSelections[featureSelectionKey] ?? [];
                const displayedSelections = Array.from(
                  new Set([...(f.selections ?? []), ...draftSelections])
                );

                return (
                <div key={f.featureId} style={{ marginBottom: "12px" }}>
                  <div>
                    <span className="label-muted">Feature: </span>
                    <span className="value-bold">
                      {f.featureName}
                    </span>
                  </div>
                  <div>
                    <span className="label-muted">Level gained: </span>
                    <span className="value-strong">
                      {f.levelGained ?? "null"}
                    </span>
                  </div>
                  <div>
                    <span className="label-muted">Description: </span>
                    <span style={{ color: "#111", fontWeight: 400 }}>
                      {f.description}
                    </span>
                  </div>
                  {displayedSelections.length > 0 && (
                    <div>
                      <span className="label-muted">Selections: </span>
                      <span style={{ color: "#111", fontWeight: 400 }}>
                        {displayedSelections
                          .map((selectionId) => {
                            const matchingOption = f.choiceOptions?.find((option) => option.id === selectionId);
                            return matchingOption?.label ?? selectionId;
                          })
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
          {renderRightPaneSection(
            "classDcAndAttack",
            "classDcAndAttack",
            <div style={{ paddingLeft: "12px", textAlign: "left" }}>
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>attackBonuses</div>
                {sheet.classDcAndAttack.attackBonuses.length > 0 ? (
                  sheet.classDcAndAttack.attackBonuses.map((entry, index) => (
                    <div key={`${entry.sourceId}-${index}`} style={{ marginBottom: "6px", paddingLeft: "12px" }}>
                      <div>sourceName: {entry.sourceName}</div>
                      <div>attackType: {entry.attackType}</div>
                      <div>ability: {entry.ability}</div>
                      <div>value: {entry.value ?? "null"}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ paddingLeft: "12px" }}>—</div>
                )}
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>saveDcs</div>
                {sheet.classDcAndAttack.saveDcs.length > 0 ? (
                  sheet.classDcAndAttack.saveDcs.map((entry, index) => (
                    <div key={`${entry.sourceId}-${index}`} style={{ marginBottom: "6px", paddingLeft: "12px" }}>
                      <div>sourceName: {entry.sourceName}</div>
                      <div>dcType: {entry.dcType}</div>
                      <div>ability: {entry.ability}</div>
                      <div>value: {entry.value ?? "null"}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ paddingLeft: "12px" }}>—</div>
                )}
              </div>
            </div>
          )}
          {renderRightPaneSection(
            "spellcasting",
            "spellcasting",
            <div style={{ paddingLeft: "12px", textAlign: "left" }}>
              <div>spellcastingAbility: {sheet.spellcasting.spellcastingAbility ?? "null"}</div>
              <div>spellSaveDc: {sheet.spellcasting.spellSaveDc ?? "null"}</div>
              <div>spellAttackBonus: {sheet.spellcasting.spellAttackBonus ?? "null"}</div>
              <div>preparedSpellLimit: {sheet.spellcasting.preparedSpellLimit ?? "null"}</div>
              <div style={{ marginTop: "8px", fontWeight: 600 }}>spellSlotsByLevel</div>
              {sheet.spellcasting.spellSlotsByLevel.length > 0 ? (
                sheet.spellcasting.spellSlotsByLevel.map((entry, index) => (
                  <div key={`${entry.source}-${entry.spellLevel}-${index}`} style={{ paddingLeft: "12px", marginBottom: "6px" }}>
                    <div>spellLevel: {entry.spellLevel}</div>
                    <div>slotsTotal: {entry.slotsTotal ?? "null"}</div>
                    <div>source: {entry.source}</div>
                  </div>
                ))
              ) : (
                <div style={{ paddingLeft: "12px" }}>—</div>
              )}
              <div style={{ marginTop: "8px", fontWeight: 600 }}>knownSpells</div>
              {sheet.spellcasting.knownSpells.length > 0 ? (
                sheet.spellcasting.knownSpells.map((entry, index) => (
                  <div key={`known-${entry.spellId}-${index}`} style={{ paddingLeft: "12px", marginBottom: "6px" }}>
                    <div>spellName: {entry.spellName}</div>
                    <div>sourceName: {entry.sourceName}</div>
                    <div>isAlwaysPrepared: {entry.isAlwaysPrepared ? "true" : "false"}</div>
                    <div>countsAgainstLimit: {entry.countsAgainstLimit ? "true" : "false"}</div>
                  </div>
                ))
              ) : (
                <div style={{ paddingLeft: "12px" }}>—</div>
              )}
              <div style={{ marginTop: "8px", fontWeight: 600 }}>preparedSpells</div>
              {sheet.spellcasting.preparedSpells.length > 0 ? (
                sheet.spellcasting.preparedSpells.map((entry, index) => (
                  <div key={`prepared-${entry.spellId}-${index}`} style={{ paddingLeft: "12px", marginBottom: "6px" }}>
                    <div>spellName: {entry.spellName}</div>
                    <div>sourceName: {entry.sourceName}</div>
                    <div>isAlwaysPrepared: {entry.isAlwaysPrepared ? "true" : "false"}</div>
                    <div>countsAgainstLimit: {entry.countsAgainstLimit ? "true" : "false"}</div>
                  </div>
                ))
              ) : (
                <div style={{ paddingLeft: "12px" }}>—</div>
              )}
              <div style={{ marginTop: "8px", fontWeight: 600 }}>selectionState</div>
              <div style={{ paddingLeft: "12px", marginBottom: "6px" }}>
                <div>classId: {sheet.spellcasting.selectionState.classId ?? "null"}</div>
                <div>subclassId: {sheet.spellcasting.selectionState.subclassId ?? "null"}</div>
                <div>className: {sheet.spellcasting.selectionState.className || ""}</div>
                <div>subclassName: {sheet.spellcasting.selectionState.subclassName || ""}</div>
                <div>maxSpellLevel: {sheet.spellcasting.selectionState.maxSpellLevel ?? "null"}</div>
                <div>cantripSlotCount: {cantripSlots.length}</div>
                <div>spellRepertoireCount: {repertoireSlots.length}</div>
                <div>note: repertoire choices are not castable spell slots</div>
              </div>

              <div style={{ marginTop: "8px", fontWeight: 600 }}>knownSpellSlots</div>
              {sheet.spellcasting.selectionState.knownSpellSlots.length > 0 ? (
                sheet.spellcasting.selectionState.knownSpellSlots.map((slot) => (
                  <div key={slot.slotId} style={{ paddingLeft: "12px", marginBottom: "6px" }}>
                    <div>slotId: {slot.slotId}</div>
                    <div>sourceName: {slot.sourceName}</div>
                    <div>bucket: {slot.bucket}</div>
                    <div>kind: {slot.kind}</div>
                    <div>selectedSpellId: {slot.selectedSpellId ?? "null"}</div>
                    <div>allowedSpellLevels: {slot.allowedSpellLevels.length > 0 ? slot.allowedSpellLevels.join(", ") : "—"}</div>
                    <div>allowedSchools: {slot.allowedSchools.length > 0 ? slot.allowedSchools.join(", ") : "—"}</div>
                    <div>options: {slot.options.length}</div>
                  </div>
                ))
              ) : (
                <div style={{ paddingLeft: "12px" }}>—</div>
              )}

              <div style={{ marginTop: "8px", fontWeight: 600 }}>preparedSpellSlots</div>
              {sheet.spellcasting.selectionState.preparedSpellSlots.length > 0 ? (
                sheet.spellcasting.selectionState.preparedSpellSlots.map((slot) => (
                  <div key={slot.slotId} style={{ paddingLeft: "12px", marginBottom: "6px" }}>
                    <div>slotId: {slot.slotId}</div>
                    <div>sourceName: {slot.sourceName}</div>
                    <div>bucket: {slot.bucket}</div>
                    <div>kind: {slot.kind}</div>
                    <div>selectedSpellId: {slot.selectedSpellId ?? "null"}</div>
                    <div>allowedSpellLevels: {slot.allowedSpellLevels.length > 0 ? slot.allowedSpellLevels.join(", ") : "—"}</div>
                    <div>allowedSchools: {slot.allowedSchools.length > 0 ? slot.allowedSchools.join(", ") : "—"}</div>
                    <div>options: {slot.options.length}</div>
                  </div>
                ))
              ) : (
                <div style={{ paddingLeft: "12px" }}>—</div>
              )}

              <div style={{ marginTop: "8px", fontWeight: 600 }}>grantedSpellSlots</div>
              {sheet.spellcasting.selectionState.grantedSpellSlots.length > 0 ? (
                sheet.spellcasting.selectionState.grantedSpellSlots.map((slot) => (
                  <div key={slot.slotId} style={{ paddingLeft: "12px", marginBottom: "6px" }}>
                    <div>slotId: {slot.slotId}</div>
                    <div>sourceName: {slot.sourceName}</div>
                    <div>bucket: {slot.bucket}</div>
                    <div>kind: {slot.kind}</div>
                    <div>fixedSpellId: {slot.fixedSpellId ?? "null"}</div>
                    <div>selectedSpellId: {slot.selectedSpellId ?? "null"}</div>
                    <div>isAlwaysPrepared: {slot.isAlwaysPrepared ? "true" : "false"}</div>
                    <div>countsAgainstLimit: {slot.countsAgainstLimit ? "true" : "false"}</div>
                    <div>allowedSpellLevels: {slot.allowedSpellLevels.length > 0 ? slot.allowedSpellLevels.join(", ") : "—"}</div>
                    <div>allowedSchools: {slot.allowedSchools.length > 0 ? slot.allowedSchools.join(", ") : "—"}</div>
                    <div>options: {slot.options.length}</div>
                  </div>
                ))
              ) : (
                <div style={{ paddingLeft: "12px" }}>—</div>
              )}

              <div style={{ marginTop: "8px", fontWeight: 600 }}>allAvailableSpells</div>
              {sheet.spellcasting.selectionState.allAvailableSpells.length > 0 ? (
                sheet.spellcasting.selectionState.allAvailableSpells.map((spell, index) => (
                  <div key={`${spell.spellId}-${index}`} style={{ paddingLeft: "12px", marginBottom: "6px" }}>
                    <div>spellName: {spell.spellName}</div>
                    <div>spellLevel: {spell.spellLevel}</div>
                    <div>school: {spell.school}</div>
                  </div>
                ))
              ) : (
                <div style={{ paddingLeft: "12px" }}>—</div>
              )}
            </div>
          )}
          {renderRightPaneSection(
            "equipment",
            "equipment",
            <div style={{ paddingLeft: "12px", textAlign: "left" }}>
              {sheet.equipment.items.length > 0 ? (
                sheet.equipment.items.map((item, index) => {
                  const typedItem = item as Record<string, unknown>;
                  return (
                    <div key={`${String(typedItem.id ?? index)}-${index}`} style={{ marginBottom: "10px" }}>
                      <div>
                        <span className="label-muted">type: </span>
                        <span>{String(typedItem.type ?? "")}</span>
                      </div>
                      <div>
                        <span className="label-muted">name: </span>
                        <span>{String(typedItem.name ?? "")}</span>
                      </div>
                      {typedItem.category ? (
                        <div>
                          <span className="label-muted">category: </span>
                          <span>{String(typedItem.category)}</span>
                        </div>
                      ) : null}
                      {typedItem.damageDice ? (
                        <div>
                          <span className="label-muted">damage: </span>
                          <span>{`${String(typedItem.damageDice)} ${String(typedItem.damageType ?? "")}`}</span>
                        </div>
                      ) : null}
                      {typedItem.masteryTrait ? (
                        <div>
                          <span className="label-muted">mastery: </span>
                          <span>{String(typedItem.masteryTrait)}</span>
                        </div>
                      ) : null}
                      {typedItem.baseAc ? (
                        <div>
                          <span className="label-muted">baseAc: </span>
                          <span>{String(typedItem.baseAc)}</span>
                        </div>
                      ) : null}
                      {typedItem.acBonus ? (
                        <div>
                          <span className="label-muted">acBonus: </span>
                          <span>{String(typedItem.acBonus)}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div>—</div>
              )}
            </div>
          )}
          {renderRightPaneSection(
            "proficiencies",
            "proficiencies",
            <div style={{ paddingLeft: "12px", textAlign: "left" }}>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">armor: </span>
                <span style={{ color: "#111", fontWeight: 400 }}>
                  {sheet.proficiencies.armor.length > 0
                    ? sheet.proficiencies.armor.join(", ")
                    : "—"}
                </span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">weapons: </span>
                <span style={{ color: "#111", fontWeight: 400 }}>
                  {sheet.proficiencies.weapons.length > 0
                    ? sheet.proficiencies.weapons.join(", ")
                    : "—"}
                </span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span className="label-muted">tools: </span>
                <span style={{ color: "#111", fontWeight: 400 }}>
                  {sheet.proficiencies.tools.length > 0
                    ? sheet.proficiencies.tools.join(", ")
                    : "—"}
                </span>
              </div>
              <div>
                <span className="label-muted">skills: </span>
                <span style={{ color: "#111", fontWeight: 400 }}>
                  {sheet.proficiencies.skills.length > 0
                    ? sheet.proficiencies.skills.join(", ")
                    : "—"}
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          {renderRightPaneSection(
            "abilities",
            "abilities",
            <div style={{ paddingLeft: "12px", textAlign: "left" }}>
              {Object.entries(sheet.abilities).map(([key, value]) => (
                <div key={key} style={{ marginBottom: "6px" }}>
                  <div style={{ fontWeight: 600 }}>{key}</div>
                  <div style={{ paddingLeft: "12px" }}>
                    <div>score: {value.score ?? "null"}</div>
                    <div>modifier: {value.modifier ?? "null"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {renderRightPaneSection(
            "combatBasics",
            "combatBasics",
            <div style={{ paddingLeft: "12px", textAlign: "left" }}>
              <div>proficiencyBonus: {sheet.combatBasics.proficiencyBonus.value ?? "null"}</div>
              <div>initiative: {sheet.combatBasics.initiative.value ?? "null"}</div>
              <div>armorClass: {sheet.combatBasics.armorClass.value ?? "null"}</div>
              <div>speed: {displaySpeed ?? "null"}</div>
              <div>passivePerception: {sheet.combatBasics.passivePerception.value ?? "null"}</div>
              <div>perceptionModifier: {displayPerceptionModifier ?? "null"}</div>
            </div>
          )}
          {renderRightPaneSection(
            "durability",
            "durability",
            <div style={{ paddingLeft: "12px", textAlign: "left" }}>
              <div style={{ marginBottom: "6px" }}>
                <div style={{ fontWeight: 600 }}>hpMax</div>
                <div style={{ paddingLeft: "12px" }}>
                  <div>value: {sheet.durability.hpMax.value ?? "null"}</div>
                </div>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <div style={{ fontWeight: 600 }}>hitDice</div>
                <div style={{ paddingLeft: "12px" }}>
                  <div>die: {sheet.durability.hitDice.die || "null"}</div>
                  <div>total: {sheet.durability.hitDice.total ?? "null"}</div>
                </div>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <div style={{ fontWeight: 600 }}>resistances</div>
                <div style={{ paddingLeft: "12px" }}>
                  {sheet.durability.defenses.resistances.length > 0
                    ? sheet.durability.defenses.resistances.join(", ")
                    : "—"}
                </div>
              </div>
            </div>
          )}
          {renderRightPaneSection(
            "savingThrows",
            "savingThrows",
            <div style={{ paddingLeft: "12px", textAlign: "left" }}>
              {Object.entries(sheet.savingThrows).map(([key, value]) => (
                <div key={key} style={{ marginBottom: "6px" }}>
                  <div style={{ fontWeight: 600 }}>{key}</div>
                  <div style={{ paddingLeft: "12px" }}>
                    <div>proficiency: {value.proficiency}</div>
                    <div>totalModifier: {value.totalModifier ?? "null"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {renderRightPaneSection(
            "skills",
            "skills",
            <div style={{ paddingLeft: "12px", textAlign: "left" }}>
              {Object.entries(sheet.skills).map(([key, value]) => (
                <div key={key} style={{ marginBottom: "6px" }}>
                  <div style={{ fontWeight: 600 }}>{key}</div>
                  <div style={{ paddingLeft: "12px" }}>
                    <div>ability: {value.ability}</div>
                    <div>proficiency: {value.proficiency}</div>
                    <div>totalModifier: {value.totalModifier ?? "null"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    {hoverDescription ? <div className="hover-panel">{hoverDescription}</div> : null}
  </div>
);
}
