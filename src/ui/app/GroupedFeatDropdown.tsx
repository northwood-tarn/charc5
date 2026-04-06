import React from "react";

type Props = {
  slotId: string;
  openFeatDropdownSlotId: string | null;
  setOpenFeatDropdownSlotId: React.Dispatch<React.SetStateAction<string | null>>;
  setHoverDescription: (value: string) => void;
  featDropdownRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  selectedLabel: string;
  groupedFeatOptions: Array<
    | { kind: "divider"; label: string }
    | { kind: "feat"; feat: { id: string; name: string; notes?: string } }
  >;
  onClear: () => void;
  onSelect: (featId: string) => void;
};

export default function GroupedFeatDropdown({
  slotId,
  openFeatDropdownSlotId,
  setOpenFeatDropdownSlotId,
  setHoverDescription,
  featDropdownRefs,
  selectedLabel,
  groupedFeatOptions,
  onClear,
  onSelect,
}: Props) {
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
        {selectedLabel}
      </button>

      {isOpen ? (
        <div className="dropdown-menu" onMouseLeave={() => setHoverDescription("")}>
          <div
            className="dropdown-item"
            onMouseEnter={() => setHoverDescription("")}
            onClick={onClear}
          >
            --
          </div>
          {groupedFeatOptions.map((entry, index) => {
            if (entry.kind === "divider") {
              return (
                <div key={`${slotId}:divider:${index}`} className="dropdown-divider">
                  {entry.label}
                </div>
              );
            }

            return (
              <div
                key={entry.feat.id}
                className="dropdown-item"
                onMouseEnter={() => setHoverDescription(entry.feat.notes ?? "")}
                onClick={() => onSelect(entry.feat.id)}
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
