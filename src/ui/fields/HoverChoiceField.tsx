import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type HoverChoiceOption = {
  value: string;
  label: string;
  detail?: ReactNode;
  disabled?: boolean;
  preselected?: boolean;
};

export type HoverChoiceFieldProps = {
  label: string;
  options: HoverChoiceOption[];
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  onHoverDetail?: (detail: ReactNode | null) => void;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  closeOnSelect?: boolean;
  emptyDetail?: ReactNode | null;
  instructionText?: string;
  showDualClosedTicks?: boolean;
  maxSelections?: number;
};

function asArray(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

function formatClosedValue(labels: string[]): string {
  return labels.join(', ');
}

function toDisplayText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }
  return String(value);
}

export function HoverChoiceField({
  label,
  options,
  value,
  onChange,
  onHoverDetail,
  multiple = false,
  placeholder = 'Choose…',
  disabled = false,
  closeOnSelect,
  emptyDetail = null,
  instructionText,
  showDualClosedTicks = false,
  maxSelections,
}: HoverChoiceFieldProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const previousSelectedValuesRef = useRef<string[]>([]);
  const wasOpenRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedValues = useMemo(() => asArray(value), [value]);
  const safeLabel = useMemo(() => toDisplayText(label), [label]);
  const normalizedOptions = useMemo(
    () =>
      options.map((option) => ({
        ...option,
        label: toDisplayText(option.label),
      })),
    [options]
  );

  const optionMap = useMemo(() => {
    return new Map(normalizedOptions.map((option) => [option.value, option]));
  }, [normalizedOptions]);

  const selectedOptions = useMemo(() => {
    return selectedValues
      .map((selectedValue) => optionMap.get(selectedValue))
      .filter((option): option is HoverChoiceOption => Boolean(option));
  }, [selectedValues, optionMap]);

  const selectedLabels = selectedOptions.map((option) => option.label);
  const closedValueText = selectedLabels.length
    ? formatClosedValue(selectedLabels)
    : placeholder;

  const shouldCloseOnSelect = closeOnSelect ?? !multiple;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;

    if (justOpened) {
      const selectedIndex = normalizedOptions.findIndex(
        (option) => !option.disabled && selectedValues.includes(option.value)
      );
      const firstEnabledIndex = normalizedOptions.findIndex((option) => !option.disabled);
      const nextHighlightedIndex =
        selectedIndex !== -1
          ? selectedIndex
          : firstEnabledIndex === -1
            ? 0
            : firstEnabledIndex;

      setHighlightedIndex(nextHighlightedIndex);
    }

    wasOpenRef.current = isOpen;
  }, [isOpen, normalizedOptions, selectedValues]);


  useEffect(() => {
    if (!isOpen || !listRef.current) return;

    const active = listRef.current.querySelector<HTMLElement>(
      `[data-hover-choice-index="${highlightedIndex}"]`
    );
    active?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  useEffect(() => {
    if (!isOpen || multiple) {
      previousSelectedValuesRef.current = selectedValues;
      return;
    }

    const previousSelectedValues = previousSelectedValuesRef.current;
    const selectionChanged =
      previousSelectedValues.length !== selectedValues.length ||
      previousSelectedValues.some((value, index) => value !== selectedValues[index]);

    if (selectionChanged && selectedValues.length) {
      setIsOpen(false);
    }

    previousSelectedValuesRef.current = selectedValues;
  }, [isOpen, multiple, selectedValues]);

  function emitDetail(detail: ReactNode | null | undefined) {
    onHoverDetail?.(detail ?? null);
  }

  function emitOptionDetail(option: HoverChoiceOption | undefined) {
    if (!option) {
      emitDetail(emptyDetail);
      return;
    }

    emitDetail(option.detail ?? null);
  }

  function highlightOption(index: number, option: HoverChoiceOption | undefined) {
    setHighlightedIndex(index);
    emitOptionDetail(option);
  }

  function updateValue(nextValues: string[]) {
    if (multiple) {
      onChange(nextValues);
      return;
    }

    onChange(nextValues[0] ?? '');
  }

  function toggleOption(option: HoverChoiceOption) {
    if (option.disabled || disabled) return;

    if (multiple) {
      const exists = selectedValues.includes(option.value);

      if (!exists && maxSelections && selectedValues.length >= maxSelections) {
        emitOptionDetail(option);
        return;
      }

      const nextValues = exists
        ? selectedValues.filter((item) => item !== option.value)
        : [...selectedValues, option.value];

      updateValue(nextValues);
      emitOptionDetail(option);

      if (!exists && maxSelections && nextValues.length >= maxSelections) {
        setIsOpen(false);
      }

      return;
    }

    updateValue([option.value]);
    emitOptionDetail(option);
    if (shouldCloseOnSelect) {
      setIsOpen(false);
    }
  }

  function moveHighlight(direction: 1 | -1) {
    if (!normalizedOptions.length) return;

    let nextIndex = highlightedIndex;

    for (let i = 0; i < normalizedOptions.length; i += 1) {
      nextIndex = (nextIndex + direction + normalizedOptions.length) % normalizedOptions.length;
      if (!normalizedOptions[nextIndex]?.disabled) {
        setHighlightedIndex(nextIndex);
        emitOptionDetail(normalizedOptions[nextIndex]);
        return;
      }
    }
  }

  function handleControlKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      moveHighlight(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      moveHighlight(-1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }

      const option = normalizedOptions[highlightedIndex];
      if (option) {
        toggleOption(option);
      }
    }
  }

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: '391px',
        maxWidth: '100%',
      }}
      onMouseEnter={() => {
        if (!selectedOptions.length) {
          emitDetail(emptyDetail);
          return;
        }

        if (!multiple && selectedOptions[0]) {
          emitOptionDetail(selectedOptions[0]);
          return;
        }

        emitDetail(emptyDetail);
      }}
      onMouseLeave={() => emitDetail(null)}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setIsOpen((current) => !current);
        }}
        onKeyDown={handleControlKeyDown}
        style={{
          width: '100%',
          minHeight: '48px',
          border: '1px solid rgba(112, 104, 96, 0.20)',
          background: 'rgba(255, 255, 255, 0.10)',
          color: 'rgba(58, 52, 48, 0.96)',
          padding: '10px 12px',
          borderRadius: 0,
          fontSize: '0.98rem',
          fontWeight: 500,
          letterSpacing: '0.05em',
          boxShadow: 'none',
          textAlign: 'left',
          textTransform: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        <span
          style={{
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            lineHeight: 1.35,
          }}
        >
          <span style={{ color: '#6e92aa', fontWeight: 400 }}>{safeLabel}:</span>
          {!multiple && (
            <span
              style={{
                color: selectedLabels.length ? 'inherit' : 'rgba(112, 104, 96, 0.72)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                minWidth: 0,
                flex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {showDualClosedTicks && selectedOptions[0]?.preselected && (
                <>
                  <span aria-hidden="true" style={{ color: 'rgba(58, 52, 48, 0.96)', fontWeight: 700, flex: '0 0 auto' }}>
                    ✓
                  </span>
                  <span aria-hidden="true" style={{ color: '#6e92aa', fontWeight: 700, flex: '0 0 auto' }}>
                    ✓
                  </span>
                </>
              )}
              <span
                style={{
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {closedValueText}
              </span>
            </span>
          )}
          {multiple && (
            <span
              style={{
                color: selectedLabels.length ? 'inherit' : 'rgba(112, 104, 96, 0.72)',
                minWidth: 0,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedOptions.length ? (
                selectedOptions.map((option, index) => (
                  <span
                    key={option.value}
                    onMouseEnter={(event) => {
                      event.stopPropagation();
                      emitOptionDetail(option);
                    }}
                  >
                    {showDualClosedTicks && option.preselected ? '✓ ✓ ' : option.preselected ? '✓ ' : ''}
                    {option.label}
                    {index < selectedOptions.length - 1 ? ', ' : ''}
                  </span>
                ))
              ) : (
                placeholder
              )}
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          style={{
            flex: '0 0 auto',
            color: 'rgba(82, 76, 69, 0.55)',
            fontSize: '0.7rem',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 120ms ease',
          }}
        >
          ▾
        </span>
      </button>

      {isOpen && (
        <div
          ref={listRef}
          role="listbox"
          aria-multiselectable={multiple || undefined}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 20,
            border: '1px solid rgba(112, 104, 96, 0.30)',
            background: 'rgba(248, 244, 239, 0.98)',
            boxShadow: '0 10px 24px rgba(0, 0, 0, 0.08)',
            maxHeight: '280px',
            overflowY: 'auto',
          }}
        >
          {instructionText && (
            <div
              style={{
                padding: '11px 14px',
                borderBottom: '1px solid rgba(112, 104, 96, 0.18)',
                color: 'rgba(82, 76, 69, 0.72)',
                fontSize: '0.9rem',
                letterSpacing: '0.04em',
                background: 'rgba(255, 255, 255, 0.22)',
              }}
              onMouseEnter={() => emitDetail(emptyDetail)}
              onPointerEnter={() => emitDetail(emptyDetail)}
            >
              {instructionText}
            </div>
          )}
          {normalizedOptions.map((option, index) => {
            const selected = selectedValues.includes(option.value);
            const highlighted = index === highlightedIndex;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                data-hover-choice-index={index}
                disabled={option.disabled}
                onMouseEnter={() => {
                  highlightOption(index, option);
                }}
                onPointerEnter={() => {
                  highlightOption(index, option);
                }}
                onPointerMove={() => {
                  highlightOption(index, option);
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleOption(option);
                }}
                style={{
                  width: '100%',
                  border: 'none',
                  background: highlighted
                    ? 'rgba(110, 146, 170, 0.12)'
                    : 'transparent',
                  color: option.disabled || (!selected && multiple && !!maxSelections && selectedValues.length >= maxSelections)
                    ? 'rgba(82, 76, 69, 0.42)'
                    : 'rgba(58, 52, 48, 0.96)',
                  padding: '11px 14px',
                  textAlign: 'left',
                  textTransform: 'none',
                  fontSize: '0.96rem',
                  fontWeight: 400,
                  letterSpacing: '0.04em',
                  cursor: option.disabled || (!selected && multiple && !!maxSelections && selectedValues.length >= maxSelections)
                    ? 'default'
                    : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <span>{option.label}</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minWidth: '16px',
                    justifyContent: 'flex-end',
                  }}
                >
                  {selected ? (
                    <span aria-hidden="true" style={{ color: '#6e92aa', fontWeight: 700 }}>
                      ✓
                    </span>
                  ) : option.preselected ? (
                    <span aria-hidden="true" style={{ color: 'rgba(58, 52, 48, 0.96)', fontWeight: 700 }}>
                      ✓
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
