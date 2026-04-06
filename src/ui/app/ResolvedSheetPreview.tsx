import React, { type CSSProperties, type ReactNode } from "react";

type Props = {
  sheet: any;
  allResolvedFeatures: any[];
  safeDraft: any;
  displayHeight: string | number | null;
  displaySpeed: string | number | null;
  displayPerceptionModifier: string | number | null;
  cantripSlots: any[];
  repertoireSlots: any[];
};

function renderSection(
  title: string,
  content: ReactNode,
  options?: { marginBottom?: string; textTransform?: CSSProperties["textTransform"] }
) {
  return (
    <div className="resolved-sheet-section" style={{ marginBottom: options?.marginBottom }}>
      <div className="resolved-sheet-heading" style={{ textTransform: options?.textTransform }}>
        {title}
      </div>
      <div>{content}</div>
    </div>
  );
}

export default function ResolvedSheetPreview({
  sheet,
  allResolvedFeatures,
  safeDraft,
  displayHeight,
  displaySpeed,
  displayPerceptionModifier,
  cantripSlots,
  repertoireSlots,
}: Props) {
  return (
    <div className="resolved-sheet-content">
      <div className="resolved-sheet-columns">
        {renderSection(
          "Identity",
          <>
            <div>Character name: {sheet.identity.characterName || ""}</div>
            <div>classId: {sheet.identity.classId ?? "null"}</div>
            <div>className: {sheet.identity.className || ""}</div>
            <div>subclassId: {sheet.identity.subclassId ?? "null"}</div>
            <div>subclassName: {sheet.identity.subclassName || ""}</div>
            <div>level: {sheet.identity.level ?? "null"}</div>
            <div>speciesId: {sheet.identity.speciesId ?? "null"}</div>
            <div>speciesName: {sheet.identity.speciesName || ""}</div>
            <div>lineageId: {sheet.identity.lineageId ?? "null"}</div>
            <div>lineageName: {sheet.identity.lineageName || ""}</div>
            <div>backgroundId: {sheet.identity.backgroundId ?? "null"}</div>
            <div>backgroundName: {sheet.identity.backgroundName || ""}</div>
            <div>height: {displayHeight ?? "null"}</div>
          </>,
          { textTransform: "capitalize" }
        )}

        {renderSection(
          "Features",
          <>
            {allResolvedFeatures.map((f) => {
              const featureSelectionKey = f.selectionKey ?? f.featureId;
              const draftSelections = safeDraft.featureSelections[featureSelectionKey] ?? [];
              const displayedSelections = Array.from(
                new Set([...(f.selections ?? []), ...draftSelections])
              );

              return (
                <div key={f.featureId} style={{ marginBottom: "6px" }}>
                  <div>{f.featureName}</div>
                  <div>Level gained: {f.levelGained ?? "null"}</div>
                  {displayedSelections.length > 0 ? (
                    <div>
                      Selections: {displayedSelections
                        .map((selectionId) => {
                          const matchingOption = f.choiceOptions?.find((option: any) => option.id === selectionId);
                          return matchingOption?.label ?? selectionId;
                        })
                        .join(", ")}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </>
        )}

        {renderSection(
          "classDcAndAttack",
          <>
            <div style={{ fontWeight: 700, marginBottom: "4px" }}>attackBonuses</div>
            {sheet.classDcAndAttack.attackBonuses.length > 0 ? (
              sheet.classDcAndAttack.attackBonuses.map((entry: any, index: number) => (
                <div key={`${entry.sourceId}-${index}`} style={{ marginBottom: "6px" }}>
                  <div>sourceName: {entry.sourceName}</div>
                  <div>attackType: {entry.attackType}</div>
                  <div>ability: {entry.ability}</div>
                  <div>value: {entry.value ?? "null"}</div>
                </div>
              ))
            ) : (
              <div>—</div>
            )}

            <div style={{ fontWeight: 700, marginTop: "6px", marginBottom: "4px" }}>saveDcs</div>
            {sheet.classDcAndAttack.saveDcs.length > 0 ? (
              sheet.classDcAndAttack.saveDcs.map((entry: any, index: number) => (
                <div key={`${entry.sourceId}-${index}`} style={{ marginBottom: "6px" }}>
                  <div>sourceName: {entry.sourceName}</div>
                  <div>dcType: {entry.dcType}</div>
                  <div>ability: {entry.ability}</div>
                  <div>value: {entry.value ?? "null"}</div>
                </div>
              ))
            ) : (
              <div>—</div>
            )}
          </>
        )}

        {renderSection(
          "spellcasting",
          <>
            <div>spellcastingAbility: {sheet.spellcasting.spellcastingAbility ?? "null"}</div>
            <div>spellSaveDc: {sheet.spellcasting.spellSaveDc ?? "null"}</div>
            <div>spellAttackBonus: {sheet.spellcasting.spellAttackBonus ?? "null"}</div>
            <div>preparedSpellLimit: {sheet.spellcasting.preparedSpellLimit ?? "null"}</div>

            <div style={{ fontWeight: 700, marginTop: "6px", marginBottom: "4px" }}>spellSlotsByLevel</div>
            {sheet.spellcasting.spellSlotsByLevel.length > 0 ? (
              sheet.spellcasting.spellSlotsByLevel.map((entry: any, index: number) => (
                <div key={`${entry.source}-${entry.spellLevel}-${index}`} style={{ marginBottom: "6px" }}>
                  <div>spellLevel: {entry.spellLevel}</div>
                  <div>slotsTotal: {entry.slotsTotal ?? "null"}</div>
                  <div>source: {entry.source}</div>
                </div>
              ))
            ) : (
              <div>—</div>
            )}

            <div style={{ fontWeight: 700, marginTop: "6px", marginBottom: "4px" }}>knownSpells</div>
            {sheet.spellcasting.knownSpells.length > 0 ? (
              sheet.spellcasting.knownSpells.map((entry: any, index: number) => (
                <div key={`known-${entry.spellId}-${index}`} style={{ marginBottom: "6px" }}>
                  <div>spellName: {entry.spellName}</div>
                  <div>sourceName: {entry.sourceName}</div>
                  <div>isAlwaysPrepared: {entry.isAlwaysPrepared ? "true" : "false"}</div>
                  <div>countsAgainstLimit: {entry.countsAgainstLimit ? "true" : "false"}</div>
                </div>
              ))
            ) : (
              <div>—</div>
            )}

            <div style={{ fontWeight: 700, marginTop: "6px", marginBottom: "4px" }}>preparedSpells</div>
            {sheet.spellcasting.preparedSpells.length > 0 ? (
              sheet.spellcasting.preparedSpells.map((entry: any, index: number) => (
                <div key={`prepared-${entry.spellId}-${index}`} style={{ marginBottom: "6px" }}>
                  <div>spellName: {entry.spellName}</div>
                  <div>sourceName: {entry.sourceName}</div>
                  <div>isAlwaysPrepared: {entry.isAlwaysPrepared ? "true" : "false"}</div>
                  <div>countsAgainstLimit: {entry.countsAgainstLimit ? "true" : "false"}</div>
                </div>
              ))
            ) : (
              <div>—</div>
            )}

            <div style={{ fontWeight: 700, marginTop: "6px", marginBottom: "4px" }}>selectionState</div>
            <div>classId: {sheet.spellcasting.selectionState.classId ?? "null"}</div>
            <div>subclassId: {sheet.spellcasting.selectionState.subclassId ?? "null"}</div>
            <div>className: {sheet.spellcasting.selectionState.className || ""}</div>
            <div>subclassName: {sheet.spellcasting.selectionState.subclassName || ""}</div>
            <div>maxSpellLevel: {sheet.spellcasting.selectionState.maxSpellLevel ?? "null"}</div>
            <div>cantripSlotCount: {cantripSlots.length}</div>
            <div>spellRepertoireCount: {repertoireSlots.length}</div>
            <div>note: repertoire choices are not castable spell slots</div>
          </>
        )}

        {renderSection(
          "equipment",
          <>
            {sheet.equipment.items.length > 0 ? (
              sheet.equipment.items.map((item: any, index: number) => {
                const typedItem = item as Record<string, unknown>;
                return (
                  <div key={`${String(typedItem.id ?? index)}-${index}`} style={{ marginBottom: "6px" }}>
                    <div>type: {String(typedItem.type ?? "")}</div>
                    <div>name: {String(typedItem.name ?? "")}</div>
                    {typedItem.category ? <div>category: {String(typedItem.category)}</div> : null}
                    {typedItem.damageDice ? <div>damage: {`${String(typedItem.damageDice)} ${String(typedItem.damageType ?? "")}`}</div> : null}
                    {typedItem.masteryTrait ? <div>mastery: {String(typedItem.masteryTrait)}</div> : null}
                    {typedItem.baseAc ? <div>baseAc: {String(typedItem.baseAc)}</div> : null}
                    {typedItem.acBonus ? <div>acBonus: {String(typedItem.acBonus)}</div> : null}
                  </div>
                );
              })
            ) : (
              <div>—</div>
            )}
          </>
        )}

        {renderSection(
          "proficiencies",
          <>
            <div>armor: {sheet.proficiencies.armor.length > 0 ? sheet.proficiencies.armor.join(", ") : "—"}</div>
            <div>weapons: {sheet.proficiencies.weapons.length > 0 ? sheet.proficiencies.weapons.join(", ") : "—"}</div>
            <div>tools: {sheet.proficiencies.tools.length > 0 ? sheet.proficiencies.tools.join(", ") : "—"}</div>
            <div>skills: {sheet.proficiencies.skills.length > 0 ? sheet.proficiencies.skills.join(", ") : "—"}</div>
          </>
        )}

        {renderSection(
          "abilities",
          <>
            {Object.entries(sheet.abilities).map(([key, value]: any) => (
              <div key={key} style={{ marginBottom: "6px" }}>
                <div style={{ fontWeight: 700 }}>{key}</div>
                <div>score: {value.score ?? "null"}</div>
                <div>modifier: {value.modifier ?? "null"}</div>
              </div>
            ))}
          </>
        )}

        {renderSection(
          "combatBasics",
          <>
            <div>proficiencyBonus: {sheet.combatBasics.proficiencyBonus.value ?? "null"}</div>
            <div>initiative: {sheet.combatBasics.initiative.value ?? "null"}</div>
            <div>armorClass: {sheet.combatBasics.armorClass.value ?? "null"}</div>
            <div>speed: {displaySpeed ?? "null"}</div>
            <div>passivePerception: {sheet.combatBasics.passivePerception.value ?? "null"}</div>
            <div>perceptionModifier: {displayPerceptionModifier ?? "null"}</div>
          </>
        )}

        {renderSection(
          "durability",
          <>
            <div style={{ fontWeight: 700, marginBottom: "4px" }}>hpMax</div>
            <div>value: {sheet.durability.hpMax.value ?? "null"}</div>

            <div style={{ fontWeight: 700, marginTop: "6px", marginBottom: "4px" }}>hitDice</div>
            <div>die: {sheet.durability.hitDice.die || "null"}</div>
            <div>total: {sheet.durability.hitDice.total ?? "null"}</div>

            <div style={{ fontWeight: 700, marginTop: "6px", marginBottom: "4px" }}>resistances</div>
            <div>{sheet.durability.defenses.resistances.length > 0 ? sheet.durability.defenses.resistances.join(", ") : "—"}</div>
          </>
        )}

        {renderSection(
          "savingThrows",
          <>
            {Object.entries(sheet.savingThrows).map(([key, value]: any) => (
              <div key={key} style={{ marginBottom: "6px" }}>
                <div style={{ fontWeight: 700 }}>{key}</div>
                <div>proficiency: {value.proficiency}</div>
                <div>totalModifier: {value.totalModifier ?? "null"}</div>
              </div>
            ))}
          </>
        )}

        {renderSection(
          "skills",
          <>
            {Object.entries(sheet.skills).map(([key, value]: any) => (
              <div key={key} style={{ marginBottom: "6px" }}>
                <div style={{ fontWeight: 700 }}>{key}</div>
                <div>ability: {value.ability}</div>
                <div>proficiency: {value.proficiency}</div>
                <div>totalModifier: {value.totalModifier ?? "null"}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
