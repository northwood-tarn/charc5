import React, { type ChangeEvent, type ReactNode } from "react";

type Props = {
  utilityMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  hoverDescription: string;
  isUtilityMenuOpen: boolean;
  setIsUtilityMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleSave: () => void;
  handleLoad: () => void;
  handleImportButtonClick: () => void;
  handleExportJson: () => void;
  isResolvedSheetOpen: boolean;
  setIsResolvedSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  importFileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  handleImportJson: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  resolvedSheetContent: ReactNode;
};

export default function UtilityMenu({
  utilityMenuRef,
  hoverDescription,
  isUtilityMenuOpen,
  setIsUtilityMenuOpen,
  handleSave,
  handleLoad,
  handleImportButtonClick,
  handleExportJson,
  isResolvedSheetOpen,
  setIsResolvedSheetOpen,
  importFileInputRef,
  handleImportJson,
  resolvedSheetContent,
}: Props) {
  return (
    <>
      <div
        ref={utilityMenuRef}
        className="utility-menu-anchor"
        style={{ bottom: hoverDescription ? "56px" : "16px" }}
      >
        <button
          type="button"
          aria-label="Open utility menu"
          onClick={() => setIsUtilityMenuOpen((current) => !current)}
          className="round-icon-button"
        >
          ⚙
        </button>

        {isUtilityMenuOpen ? (
          <div className="utility-menu-popout">
            <button type="button" className="dropdown-button" onClick={handleSave}>Save</button>
            <button type="button" className="dropdown-button" onClick={handleLoad}>Load</button>
            <button type="button" className="dropdown-button" onClick={handleImportButtonClick}>Import JSON</button>
            <button type="button" className="dropdown-button" onClick={handleExportJson}>Export JSON</button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Resolved sheet"
        onMouseEnter={() => setIsResolvedSheetOpen(true)}
        onMouseLeave={() => setIsResolvedSheetOpen(false)}
        className="round-icon-button resolved-sheet-toggle"
        style={{ bottom: hoverDescription ? "56px" : "16px" }}
      >
        📄
      </button>
      <input
        ref={importFileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={handleImportJson}
      />
      {isResolvedSheetOpen ? (
        <div
          className="resolved-sheet-popup"
          style={{ bottom: hoverDescription ? "96px" : "56px" }}
        >
          {resolvedSheetContent}
        </div>
      ) : null}
    </>
  );
}
