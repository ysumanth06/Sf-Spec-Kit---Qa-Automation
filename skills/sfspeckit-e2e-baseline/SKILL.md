---
name: sfspeckit-e2e-baseline
description: "Scan a Salesforce org and generate foundational regression E2E tests. Supports full org scan, object-scoped scan with dependency graph expansion, standard domain scoping (Sales, Service, FieldService), and custom domain clusters. Produces JSON DSL baseline test files for CRUD, Validation Rules, Picklists, and Record Types."
---

# /sfspeckit-e2e-baseline — Baseline Regression Test Generator

## Overview

Scan Salesforce org metadata and automatically generate foundational regression tests. These baseline tests cover CRUD access, Validation Rules, Picklist values, and Record Types — the building blocks that must always pass.

## Who Runs This

**QA Tester** (non-technical). No coding required.

## Prerequisites

- Framework installed: `npm install` in `.agents/skills/sfspeckit-e2e/framework/`
- `personas.json` and `.env` configured
- `npm run qa:doctor` passes all checks

## Input — Scope Detection

Analyze the user's prompt to determine the scan scope:

### Option 1: Full Org
```
/sfspeckit-e2e-baseline full org
/sfspeckit-e2e-baseline everything
```
→ Scans ALL custom objects + standard objects with customizations. **Warn the user** if the org may be large.

### Option 2: Specific Objects
```
/sfspeckit-e2e-baseline Account, Contact, Opportunity
/sfspeckit-e2e-baseline for Account and Case
```
→ Extract the object API names → expand via Dependency Graph → scan only those objects.

### Option 3: Standard Domain
```
/sfspeckit-e2e-baseline Sales
/sfspeckit-e2e-baseline Service
/sfspeckit-e2e-baseline FieldService
```
→ Map to predefined object clusters:
- **Sales** → Lead, Campaign, Account, Contact, Opportunity, OpportunityLineItem, Quote, QuoteLineItem, Product2, Pricebook2, PricebookEntry
- **Service** → Case, CaseComment, Entitlement, ServiceContract, Solution
- **FieldService** → ServiceAppointment, WorkOrder, WorkOrderLineItem, ServiceResource, ServiceTerritory

### Option 4: Custom Domain
```
/sfspeckit-e2e-baseline CongaContracting
```
→ Read `.agents/skills/sfspeckit-e2e/framework/domains.json` for the object list. If the domain doesn't exist, ask the user to add it to `domains.json`.

**Always acknowledge** the detected scope before beginning the scan:
> "I detected scope: **Sales domain** (11 objects: Lead, Campaign, Account, Contact, ...). Proceeding with the scan."

## Execution Steps

### Step 1: Resolve Objects

Based on the scope detection above, determine the final list of objects to scan. If using object-scoped mode, expand the Dependency Graph to include child relationships.

Dependency graph logic: `.agents/skills/sfspeckit-e2e/framework/generators/baseline-scanner.ts` → `expandDependencyGraph()`

### Step 2: Scan Org Metadata

Use the internal metadata scanner to query:
- Object Permissions per profile (Create/Read/Edit/Delete)
- Field Permissions per profile (Read/Edit)
- Active Validation Rules with error messages
- Picklist values (active, default)
- Record Types (active)
- Flows targeting these objects
- Tab Visibilities
- Layout Assignments

Scanner: `.agents/skills/sfspeckit-e2e/framework/utils/internal-metadata-scanner.ts` → `scanOrgMetadata()`

### Step 3: Generate Baseline JSON Tests

> **CRITICAL**: Generate ONLY `.test.json` files. NEVER generate raw `.spec.ts` TypeScript.

For **each object**:
- **CRUD tests**: Per persona — can they Read? Create? Edit? Delete?
- **Validation Rule tests**: Does each VR fire with invalid data?
- **Record Type tests**: Can each active RT be selected?

Save to: `framework/tests/baseline/<object-name>.test.json`

### Step 4: Report Summary

Output to the user:
- Number of objects scanned
- Number of tests generated per object
- Total test count
- Any objects that could not be scanned (managed packages, etc.)

## CLI Alternative

QA testers can also run the scanner directly:

```bash
cd .agents/skills/sfspeckit-e2e/framework/
npx tsx generators/baseline-scanner.ts Sales
npx tsx generators/baseline-scanner.ts Account,Contact,Opportunity
```

## Custom Domains

QA testers can create custom domain clusters by editing `framework/domains.json`:

```json
{
  "domains": {
    "Sales": ["Lead", "Campaign", "Account", "Contact", "Opportunity"],
    "CongaContracting": ["Opportunity", "Apttus__APTS_Agreement__c", "Apttus__APTS_Template__c"]
  }
}
```

## Output

- **Baseline Test Files**: `framework/tests/baseline/<object>.test.json`
- **Console Summary**: Object count, test count, any scan warnings
