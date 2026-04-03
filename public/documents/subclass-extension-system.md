

# Subclass Extension System (Append-Only Module Architecture)

## Purpose

This document defines the **approved method for extending the builder with new subclasses** without modifying core data files.

The goal is:

- Zero mutation of existing CSV/JSON
- Strict structural compatibility with the current system
- Fully deterministic integration into existing loaders and resolvers

This is an **append-only system**. No overrides. No patches to core files.

---

## Core Principle

All new subclasses must be introduced as **external modules** that are:

- Structurally identical to existing data
- Validated before loading
- Merged at load-time only

If a subclass cannot be expressed in the exact same schema as existing ones, it is **invalid**.

---

## High-Level Flow

1. User fills out a structured form (builder-style UI)
2. Form generates a **subclass module file**
3. Module is validated against schema
4. Module is appended at load-time via loader
5. System treats it as native content

---

## Module Structure

Each subclass module must include:

### 1. Metadata

```
{
  "class_id": "fighter",
  "subclass_id": "my_custom_subclass",
  "subclass_name": "My Custom Subclass"
}
```

### 2. Class Features

Must match `classFeatures.json` structure exactly.

Requirements:

- Correct `level`
- Correct `feature_id`
- Correct `type` (`paper`, `choice`, `resource`, `derived_output`)
- No invented fields

---

### 3. Resource Scaling (Optional)

If the subclass introduces scaling resources:

- Must match `classResourceScaling.csv` format exactly
- Must include:
  - class_id
  - subclass_id
  - resource_id
  - level/value pairs

---

### 4. Spell Data (If Applicable)

If subclass grants spells:

- Must follow existing spell structures
- Must NOT introduce new spell schemas
- Must integrate into existing spell pipelines

---

## Loader Requirements

A new loader must be introduced:

`loadSubclassModules()`

Responsibilities:

- Load all external subclass modules
- Validate schema before merge
- Append to in-memory registries only

Strict rules:

- NEVER mutate base registries
- NEVER overwrite existing IDs
- Fail hard on conflicts

---

## Validation Rules

Every module must pass:

### Structural Validation

- Required fields present
- Types match expected schema
- No unknown keys

### Identity Validation

- `subclass_id` must be globally unique
- Must not collide with existing subclass IDs

### Feature Validation

- Feature types must be valid
- Choice features must define valid follow-ups
- Resource features must align with resource system

---

## UI Form Design

The form used to create subclasses must:

- Mirror the builder structure exactly
- Use the same dropdowns and choice systems
- Prevent invalid combinations

Key principle:

> If the builder cannot produce it, the extension system cannot accept it.

---

## Homogeneity Requirement

All subclass modules must be **indistinguishable from native data** once loaded.

No:

- Special-case handling
- Conditional logic in resolvers
- Alternate pipelines

Everything must pass through:

- Existing loaders
- Existing resolvers
- Existing UI components

---

## Explicit Constraints

- No editing of base CSV files
- No editing of base JSON files
- No partial overrides of existing subclasses
- No duplicate IDs
- No schema drift

---

## Failure Modes (Must Hard Fail)

Reject module if:

- Missing required fields
- Invalid feature type
- Unknown schema key
- ID collision
- Malformed resource scaling
- Invalid choice structure

---

## Future Extensions

Potential additions:

- Module packaging (import/export)
- Version tagging
- Dependency support (optional)

These must still preserve:

- Append-only model
- Schema fidelity

---

## Summary

This system ensures:

- Safe extensibility
- Zero regression risk
- Full compatibility with existing architecture

The constraint is intentional:

> Extension is only allowed through strict imitation of the existing system.