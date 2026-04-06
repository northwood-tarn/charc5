import React from "react";
import { resolveChoiceOptionsFromPool } from "../../data/loaders/choiceOptionLoader";
import { getWeapons } from "../../data/loaders/gearLoader";
import { formatSkillLabel } from "./formatters";
import { HoverChoiceField } from "../fields/HoverChoiceField";

type Props = {
  feature: any;
  draft: any;
  safeDraft: any;
  sheet: any;
  choiceFeatures: any[];
  allFeatDefinitionsById: Map<string, any>;
  parsedTools: Array<{ tool_id: string; tool_name: string; tool_type?: string }>;
  allWeaponOptions: Array<{ id: string; name: string }>;
  setDraft: (value: any) => void;
  setHoverDescription: (value: string) => void;
};

export function updateFeatureSelections({
  previousSelections,
  isSingleChoice,
  nextValue,
  count,
}: {
  previousSelections: string[];
  isSingleChoice: boolean;
  nextValue: string | null;
  count: number;
}): string[] {
  if (isSingleChoice) {
    return nextValue ? [nextValue] : [];
  }

  if (!nextValue) {
    return previousSelections;
  }

  if (previousSelections.includes(nextValue)) {
    return previousSelections.filter((value) => value !== nextValue);
  }

  const nextSelections = [...previousSelections, nextValue];
  if (count > 0) {
    return nextSelections.slice(0, count);
  }

  return nextSelections;
}

export default function ChoiceFeatureField({
  feature,
  draft,
  safeDraft,
  sheet,
  choiceFeatures,
  allFeatDefinitionsById,
  parsedTools,
  allWeaponOptions,
  setDraft,
  setHoverDescription,
}: Props) {
  const selectionKey = feature.selectionKey ?? feature.featureId;
  const selections = safeDraft.featureSelections[selectionKey] ?? [];
  const knownSkillIds = new Set(Object.keys(sheet.skills));
  const proficientSkillIds = new Set(
    Object.entries(sheet.skills)
      .filter(([, value]: any) => value.proficiency && value.proficiency !== "none")
      .map(([skillId]) => skillId)
  );

  const detailedWeapons = getWeapons();

  const rawFeature = feature as typeof feature & {
    options?: unknown;
    availableOptions?: unknown;
    allowedOptions?: unknown;
    poolOptions?: unknown;
    choices?: unknown;
    choiceSource?: { options?: unknown };
    choicePool?: { options?: unknown; pool?: unknown } | string;
    optionPool?: { options?: unknown; pool?: unknown } | string;
    pool?: { options?: unknown; pool?: unknown } | string;
    source?: unknown;
  };

  const candidateOptionSources: unknown[] = [
    feature.choiceOptions,
    rawFeature.options,
    rawFeature.availableOptions,
    rawFeature.allowedOptions,
    rawFeature.poolOptions,
    rawFeature.choices,
    rawFeature.choiceSource?.options,
    rawFeature.choicePool?.options,
    rawFeature.optionPool?.options,
    typeof rawFeature.pool === "object" && rawFeature.pool !== null ? rawFeature.pool.options : undefined,
  ];

  const firstOptionArray = candidateOptionSources.find(
    (
      source
    ): source is Array<string | { id?: string; value?: string; label?: string; name?: string }> =>
      Array.isArray(source) && source.length > 0
  ) ?? [];

  let options = firstOptionArray
    .map((option) => {
      if (typeof option === "string") {
        return {
          id: option,
          label: formatSkillLabel(option),
        };
      }

      const raw = option as Record<string, unknown>;

      const id =
        (raw.id as string) ??
        (raw.value as string) ??
        (raw.key as string) ??
        (raw.name as string) ??
        JSON.stringify(raw);

      const label =
        (raw.label as string) ??
        (raw.name as string) ??
        (raw.id as string) ??
        (raw.value as string) ??
        id;

      return {
        id,
        label,
      };
    })
    .filter((option) => Boolean(option.id));

  if (options.length === 0) {
    const featDefinition = feature.sourceType === "feat"
      ? (allFeatDefinitionsById.get(feature.sourceId) as
          | {
              effects?: {
                toolChoices?: { pool?: string | null };
                tool_choices?: { pool?: string | null };
                weaponMasteryChoices?: { pool?: string | null };
                weapon_mastery_choices?: { pool?: string | null };
                proficiencyChoices?: { pools?: string[] | null };
                proficiency_choices?: { pools?: string[] | null };
              };
            }
          | undefined)
      : undefined;

    const directPools = [
      typeof rawFeature.pool === "string" ? rawFeature.pool : undefined,
      typeof rawFeature.choicePool === "string" ? rawFeature.choicePool : undefined,
      typeof rawFeature.optionPool === "string" ? rawFeature.optionPool : undefined,
      typeof rawFeature.pool === "object" && rawFeature.pool !== null && typeof rawFeature.pool.pool === "string"
        ? rawFeature.pool.pool
        : undefined,
      typeof rawFeature.choicePool === "object" && rawFeature.choicePool !== null && typeof rawFeature.choicePool.pool === "string"
        ? rawFeature.choicePool.pool
        : undefined,
      typeof rawFeature.optionPool === "object" && rawFeature.optionPool !== null && typeof rawFeature.optionPool.pool === "string"
        ? rawFeature.optionPool.pool
        : undefined,
    ].filter((pool): pool is string => Boolean(pool));

    const featPools = [
      featDefinition?.effects?.toolChoices?.pool,
      featDefinition?.effects?.tool_choices?.pool,
      featDefinition?.effects?.weaponMasteryChoices?.pool,
      featDefinition?.effects?.weapon_mastery_choices?.pool,
      ...(featDefinition?.effects?.proficiencyChoices?.pools ?? []),
      ...(featDefinition?.effects?.proficiency_choices?.pools ?? []),
    ].filter((pool): pool is string => Boolean(pool));

    const candidatePools = Array.from(new Set([...directPools, ...featPools]));

    const skillRows = Object.keys(sheet.skills).map((skillId) => ({
      skill_id: skillId,
      skill_name: formatSkillLabel(skillId),
    }));

    const derivedOptions = candidatePools.flatMap((pool) => {
      const resolved = resolveChoiceOptionsFromPool(pool, {
        weapons: detailedWeapons.map((weapon) => ({
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

      if (resolved.length > 0) {
        return resolved.map((option) => ({
          id: option.id,
          label: option.label,
        }));
      }

      if (pool === "musical_instruments") {
        return parsedTools
          .filter((tool) => tool.tool_type === "instrument")
          .map((tool) => ({
            id: tool.tool_id,
            label: tool.tool_name,
          }));
      }

      if (pool === "tools") {
        return parsedTools.map((tool) => ({
          id: tool.tool_id,
          label: tool.tool_name,
        }));
      }

      if (pool === "weapons") {
        return detailedWeapons.map((weapon) => ({
          id: weapon.id,
          label: weapon.name,
        }));
      }

      return [] as Array<{ id: string; label: string }>;
    });

    options = Array.from(
      new Map(derivedOptions.map((option) => [option.id, option])).values()
    );

    if (options.length === 0 && feature.choiceKind === "weapon_mastery") {
      options = detailedWeapons.map((weapon) => ({
        id: weapon.id,
        label: weapon.name,
      }));
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
      new Set([...Array.from(proficientSkillIds), ...selections])
    )
      .map((skillId) => {
        const existingOption = (feature.choiceOptions ?? []).find((option: any) => option.id === skillId);
        return {
          id: skillId,
          label: existingOption?.label ?? formatSkillLabel(skillId),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  selections.forEach((selection: string) => {
    if (options.some((option) => option.id === selection)) {
      return;
    }

    options.push({
      id: selection,
      label: formatSkillLabel(selection),
    });
  });

  const count = feature.choiceCount ?? 0;
  const isSingleChoice = count === 1;
  const isWeaponMasteryChoice = feature.choiceKind === "weapon_mastery";
  const useCompactChoiceBox = options.length > 0 && (isWeaponMasteryChoice || options.length > 6);
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

function updateSelections(nextValue: string | string[] | null) {
  console.log("CHOICE FEATURE WRITE", {
    featureId: feature.featureId,
    featureName: feature.featureName,
    incomingValue: nextValue,
    selectionsBefore: selections,
  });

  let nextSelections: string[];

  if (Array.isArray(nextValue)) {
    nextSelections = nextValue.filter(Boolean);
  } else if (typeof nextValue === "string") {
    if (isSingleChoice) {
      nextSelections = nextValue ? [nextValue] : [];
    } else {
      if (!nextValue) {
        nextSelections = [];
      } else if (selections.includes(nextValue)) {
        // toggle off
        nextSelections = selections.filter((s: string) => s !== nextValue);
      } else {
        // toggle on
        nextSelections = [...selections, nextValue];
      }
    }
  } else {
    nextSelections = [];
  }

  // enforce cap
  nextSelections = isSingleChoice
    ? nextSelections.slice(0, 1)
    : nextSelections.slice(0, Math.max(count, 0));

  console.log("CHOICE FEATURE WRITE RESULT", {
    featureId: feature.featureId,
    nextSelections,
  });

  setDraft((current: any) => ({
    ...current,
    featureSelections: {
      ...current.featureSelections,
      [selectionKey]: nextSelections,
    },
  }));
}


  console.log("CHOICE FEATURE RENDER", {
    featureId: feature.featureId,
    featureName: feature.featureName,
    sourceType: feature.sourceType,
    sourceId: feature.sourceId,
    selectionKey,
    selections,
    choiceKind: feature.choiceKind,
    choiceCount: feature.choiceCount,
    optionIds: options.map((option) => option.id),
  });

  console.log("CHOICE FEATURE MODE", {
    featureId: feature.featureId,
    featureName: feature.featureName,
    count,
    isSingleChoice,
    selections,
  });

  return (
    <div className="field-row-top">
      <HoverChoiceField
        label={feature.featureName}
        options={options.map((option) => {
          const isTakenByOtherWeaponMastery =
            isWeaponMasteryChoice && otherWeaponMasterySelections.includes(option.id);

          return {
            value: option.id,
            label:
              isTakenByOtherWeaponMastery && !selections.includes(option.id)
                ? `✓ ${option.label}`
                : option.label,
            detail: feature.description ?? feature.featureName ?? "",
          };
        })}
        value={isSingleChoice ? selections[0] ?? "" : selections}
        onChange={(value) => {
          if (isSingleChoice) {
            const next =
              typeof value === "string"
                ? value
                : Array.isArray(value)
                  ? value[0] ?? null
                  : null;

            updateSelections(next);
            return;
          }

          updateSelections(value as string | string[] | null);
        }}
        onHoverDetail={(detail) => {
          if (typeof detail === "string" && detail.trim().length > 0) {
            setHoverDescription(detail);
            return;
          }

          setHoverDescription(feature.description ?? feature.featureName ?? "");
        }}
        placeholder="Choose…"
        instructionText={`— Choose ${count} —`}
        emptyDetail=""
        maxSelections={!isSingleChoice ? count : undefined}
        multiple={!isSingleChoice}
      />
    </div>
  );
}
