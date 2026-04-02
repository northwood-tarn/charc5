

export interface AggregationChoiceRecord {
  kind?: string;
  count?: number;
  pool?: string;
  options?: unknown[];
}

export interface AggregationFeatureRecord {
  id: string;
  name: string;
  level: number;
  choice?: AggregationChoiceRecord;
}

export interface AggregatedChoice {
  kind: string;
  primaryFeatureId: string | null;
  totalCount: number;
  pool: string | null;
  hasOptions: boolean;
}

function isUnlocked(feature: AggregationFeatureRecord, level: number | null): boolean {
  return level !== null && feature.level <= level;
}

function hasChoiceKind(feature: AggregationFeatureRecord): boolean {
  return typeof feature.choice?.kind === "string" && feature.choice.kind.length > 0;
}

function hasRenderableChoiceSource(feature: AggregationFeatureRecord): boolean {
  return (
    typeof feature.choice?.pool === "string" ||
    (Array.isArray(feature.choice?.options) && feature.choice!.options.length > 0)
  );
}

function getChoiceCount(feature: AggregationFeatureRecord): number {
  return feature.choice?.count ?? 1;
}

export function aggregateFeatureChoices(
  features: AggregationFeatureRecord[],
  level: number | null
): AggregatedChoice[] {
  const unlockedChoiceFeatures = features
    .filter((feature) => isUnlocked(feature, level))
    .filter((feature) => hasChoiceKind(feature));

  const byKind = new Map<string, AggregationFeatureRecord[]>();

  for (const feature of unlockedChoiceFeatures) {
    const kind = feature.choice!.kind!;
    const existing = byKind.get(kind) ?? [];
    existing.push(feature);
    byKind.set(kind, existing);
  }

  const aggregatedChoices: AggregatedChoice[] = [];

  for (const [kind, kindFeatures] of byKind.entries()) {
    const primaryFeature =
      kindFeatures.find((feature) => hasRenderableChoiceSource(feature)) ?? null;

    const totalCount = kindFeatures.reduce(
      (total, feature) => total + getChoiceCount(feature),
      0
    );

    aggregatedChoices.push({
      kind,
      primaryFeatureId: primaryFeature?.id ?? null,
      totalCount,
      pool:
        typeof primaryFeature?.choice?.pool === "string"
          ? primaryFeature.choice.pool
          : null,
      hasOptions:
        Array.isArray(primaryFeature?.choice?.options) &&
        primaryFeature.choice.options.length > 0,
    });
  }

  return aggregatedChoices;
}

export function findAggregatedChoice(
  aggregatedChoices: AggregatedChoice[],
  kind: string | null | undefined
): AggregatedChoice | null {
  if (!kind) {
    return null;
  }

  return aggregatedChoices.find((choice) => choice.kind === kind) ?? null;
}