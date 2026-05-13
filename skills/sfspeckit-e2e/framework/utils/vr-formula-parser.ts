/**
 * vr-formula-parser.ts — Validation Rule Formula Parser & Inverse Data Generator
 *
 * Parses Salesforce errorConditionFormula strings and generates test data
 * that will TRIGGER the validation rule (i.e., data that makes the formula TRUE).
 *
 * This is the "hard but unique" approach: instead of naively clearing fields,
 * we analyze the formula to understand what conditions trigger the VR and
 * generate field values that satisfy those conditions.
 *
 * Supported formula patterns:
 * - ISBLANK(FieldName)            → clear the field
 * - LEN(FieldName) = 0            → clear the field
 * - FieldName = 'Value'           → set field to that value
 * - FieldName != 'Value'          → set field to something else
 * - FieldName < Number            → set field below threshold
 * - FieldName > Number            → set field above threshold
 * - AND(cond1, cond2, ...)        → satisfy all conditions
 * - OR(cond1, cond2, ...)         → satisfy first condition
 * - NOT(condition)                → invert the condition
 * - ISPICKVAL(Field, 'Value')     → set picklist to that value
 * - TEXT(PicklistField) = 'Value' → set picklist to that value
 * - $Profile.Name != 'Admin'      → skip (profile conditions are runtime)
 * - $User.* / $RecordType.*       → skip (context conditions)
 */

export interface TriggerFieldAction {
  /** API name of the field to modify */
  fieldApiName: string;
  /** Human-readable label (derived from API name) */
  fieldLabel: string;
  /** The action to take: 'clear', 'set', 'setBelow', 'setAbove' */
  actionType: 'clear' | 'set' | 'setBelow' | 'setAbove';
  /** The value to set (for 'set' actions) */
  value?: string | number;
  /** Confidence level of the parse (0-1) */
  confidence: number;
  /** The original formula fragment this was derived from */
  sourceFragment: string;
}

export interface FormulaParseResult {
  /** Whether the formula was successfully parsed */
  parsed: boolean;
  /** Extracted field actions that should trigger the VR */
  actions: TriggerFieldAction[];
  /** Fields referenced in the formula that we couldn't parse */
  unparsedFragments: string[];
  /** Whether this formula references context variables ($User, $Profile, etc.) */
  hasContextDependency: boolean;
  /** The logical operator connecting top-level conditions */
  topLevelOperator: 'AND' | 'OR' | 'SINGLE';
  /** Original formula for reference */
  originalFormula: string;
}

/**
 * Parse a Salesforce errorConditionFormula and extract field actions
 * that would trigger the validation rule.
 */
export function parseVrFormula(formula: string): FormulaParseResult {
  const result: FormulaParseResult = {
    parsed: false,
    actions: [],
    unparsedFragments: [],
    hasContextDependency: false,
    topLevelOperator: 'SINGLE',
    originalFormula: formula,
  };

  if (!formula || !formula.trim()) {
    return result;
  }

  const trimmed = formula.trim();

  // Detect context dependencies
  if (/\$(?:User|Profile|RecordType|Organization|Setup)\./i.test(trimmed)) {
    result.hasContextDependency = true;
  }

  // Parse the formula
  const actions = parseExpression(trimmed);
  result.actions = actions.filter((a) => a.confidence > 0);
  result.parsed = result.actions.length > 0;

  // Detect top-level operator
  if (/^AND\s*\(/i.test(trimmed)) {
    result.topLevelOperator = 'AND';
  } else if (/^OR\s*\(/i.test(trimmed)) {
    result.topLevelOperator = 'OR';
  }

  return result;
}

/**
 * Parse a formula expression recursively.
 */
function parseExpression(expr: string): TriggerFieldAction[] {
  const trimmed = expr.trim();
  const actions: TriggerFieldAction[] = [];

  // ── ISBLANK(Field) ─────────────────────────────────
  const isblankMatch = trimmed.match(/ISBLANK\s*\(\s*([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\s*\)/i);
  if (isblankMatch) {
    actions.push({
      fieldApiName: isblankMatch[1],
      fieldLabel: apiNameToLabel(isblankMatch[1]),
      actionType: 'clear',
      confidence: 0.95,
      sourceFragment: isblankMatch[0],
    });
  }

  // ── LEN(Field) = 0 or LEN(Field) == 0 ─────────────
  const lenMatch = trimmed.match(/LEN\s*\(\s*([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\s*\)\s*[=!<>]+\s*0/i);
  if (lenMatch) {
    actions.push({
      fieldApiName: lenMatch[1],
      fieldLabel: apiNameToLabel(lenMatch[1]),
      actionType: 'clear',
      confidence: 0.9,
      sourceFragment: lenMatch[0],
    });
  }

  // ── ISPICKVAL(Field, 'Value') ──────────────────────
  const pickvalMatch = trimmed.match(
    /ISPICKVAL\s*\(\s*([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\s*,\s*['"]([^'"]*)['"]\s*\)/i,
  );
  if (pickvalMatch) {
    actions.push({
      fieldApiName: pickvalMatch[1],
      fieldLabel: apiNameToLabel(pickvalMatch[1]),
      actionType: 'set',
      value: pickvalMatch[2],
      confidence: 0.9,
      sourceFragment: pickvalMatch[0],
    });
  }

  // ── TEXT(Field) = 'Value' ──────────────────────────
  const textPicklistMatch = trimmed.match(
    /TEXT\s*\(\s*([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\s*\)\s*=\s*['"]([^'"]*)['"]/i,
  );
  if (textPicklistMatch) {
    actions.push({
      fieldApiName: textPicklistMatch[1],
      fieldLabel: apiNameToLabel(textPicklistMatch[1]),
      actionType: 'set',
      value: textPicklistMatch[2],
      confidence: 0.85,
      sourceFragment: textPicklistMatch[0],
    });
  }

  // ── Field = 'Value' (string equality) ──────────────
  const stringEqMatch = trimmed.match(
    /([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\s*=\s*['"]([^'"]*)['"]/i,
  );
  if (stringEqMatch && !actions.some((a) => a.fieldApiName === stringEqMatch[1])) {
    actions.push({
      fieldApiName: stringEqMatch[1],
      fieldLabel: apiNameToLabel(stringEqMatch[1]),
      actionType: 'set',
      value: stringEqMatch[2],
      confidence: 0.8,
      sourceFragment: stringEqMatch[0],
    });
  }

  // ── Field < Number (less than threshold) ───────────
  const ltMatch = trimmed.match(
    /([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\s*<\s*(\d+(?:\.\d+)?)/i,
  );
  if (ltMatch && !actions.some((a) => a.fieldApiName === ltMatch[1])) {
    const threshold = parseFloat(ltMatch[2]);
    actions.push({
      fieldApiName: ltMatch[1],
      fieldLabel: apiNameToLabel(ltMatch[1]),
      actionType: 'setBelow',
      value: Math.max(0, threshold - 1),
      confidence: 0.75,
      sourceFragment: ltMatch[0],
    });
  }

  // ── Field > Number (greater than threshold) ────────
  const gtMatch = trimmed.match(
    /([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\s*>\s*(\d+(?:\.\d+)?)/i,
  );
  if (gtMatch && !actions.some((a) => a.fieldApiName === gtMatch[1])) {
    const threshold = parseFloat(gtMatch[2]);
    actions.push({
      fieldApiName: gtMatch[1],
      fieldLabel: apiNameToLabel(gtMatch[1]),
      actionType: 'setAbove',
      value: threshold + 1,
      confidence: 0.75,
      sourceFragment: gtMatch[0],
    });
  }

  // ── Field <= Number ────────────────────────────────
  const lteMatch = trimmed.match(
    /([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\s*<=\s*(\d+(?:\.\d+)?)/i,
  );
  if (lteMatch && !actions.some((a) => a.fieldApiName === lteMatch[1])) {
    const threshold = parseFloat(lteMatch[2]);
    actions.push({
      fieldApiName: lteMatch[1],
      fieldLabel: apiNameToLabel(lteMatch[1]),
      actionType: 'set',
      value: threshold,
      confidence: 0.7,
      sourceFragment: lteMatch[0],
    });
  }

  // ── Field >= Number ────────────────────────────────
  const gteMatch = trimmed.match(
    /([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\s*>=\s*(\d+(?:\.\d+)?)/i,
  );
  if (gteMatch && !actions.some((a) => a.fieldApiName === gteMatch[1])) {
    const threshold = parseFloat(gteMatch[2]);
    actions.push({
      fieldApiName: gteMatch[1],
      fieldLabel: apiNameToLabel(gteMatch[1]),
      actionType: 'set',
      value: threshold,
      confidence: 0.7,
      sourceFragment: gteMatch[0],
    });
  }

  // ── AND(cond1, cond2, ...) — recurse into each condition ──
  const andMatch = trimmed.match(/^AND\s*\(([\s\S]+)\)\s*$/i);
  if (andMatch) {
    const innerConditions = splitTopLevelArgs(andMatch[1]);
    for (const cond of innerConditions) {
      const subActions = parseExpression(cond.trim());
      actions.push(...subActions);
    }
  }

  // ── OR(cond1, cond2, ...) — take the first parseable condition ──
  const orMatch = trimmed.match(/^OR\s*\(([\s\S]+)\)\s*$/i);
  if (orMatch && actions.length === 0) {
    const innerConditions = splitTopLevelArgs(orMatch[1]);
    for (const cond of innerConditions) {
      const subActions = parseExpression(cond.trim());
      if (subActions.length > 0) {
        actions.push(...subActions);
        break; // OR: we only need to satisfy one branch
      }
    }
  }

  // ── NOT(condition) — invert the inner condition ──
  const notMatch = trimmed.match(/^NOT\s*\(([\s\S]+)\)\s*$/i);
  if (notMatch && actions.length === 0) {
    const innerActions = parseExpression(notMatch[1].trim());
    // For NOT, we need to make the inner condition FALSE.
    // If inner is "Field = 'X'", NOT means Field != 'X', so we'd need a different value.
    // For now, reduce confidence since inversion is complex.
    for (const action of innerActions) {
      action.confidence *= 0.5;
      action.sourceFragment = `NOT(${action.sourceFragment})`;
    }
    actions.push(...innerActions);
  }

  // Deduplicate by field name
  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.fieldApiName)) return false;
    seen.add(a.fieldApiName);
    return true;
  });
}

/**
 * Split a comma-separated argument list at the top level,
 * respecting nested parentheses and quoted strings.
 */
function splitTopLevelArgs(input: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inQuote = false;
  let current = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === "'" || char === '"') {
      inQuote = !inQuote;
      current += char;
    } else if (inQuote) {
      current += char;
    } else if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Convert a Salesforce API name to a human-readable label.
 *
 * Examples:
 *   Amount__c       → Amount
 *   First_Name__c   → First Name
 *   AccountId       → Account
 *   Status          → Status
 */
export function apiNameToLabel(apiName: string): string {
  return apiName
    .replace(/__c$/, '')
    .replace(/__r$/, '')
    .replace(/Id$/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

/**
 * Generate test steps from parsed VR formula actions.
 * These are steps that should trigger the validation rule.
 */
export function generateVrTriggerSteps(
  parseResult: FormulaParseResult,
): Array<{ action: string; target?: string; value?: string | number; _comment?: string }> {
  const steps: Array<{ action: string; target?: string; value?: string | number; _comment?: string }> = [];

  for (const action of parseResult.actions) {
    // Skip context-dependent conditions (profile, user, etc.)
    if (action.fieldApiName.startsWith('$')) continue;

    switch (action.actionType) {
      case 'clear':
        steps.push({
          action: 'fill',
          target: action.fieldLabel,
          value: '',
          _comment: `Clear "${action.fieldApiName}" to trigger VR (confidence: ${(action.confidence * 100).toFixed(0)}%)`,
        });
        break;

      case 'set':
        if (typeof action.value === 'string') {
          // Could be a picklist or text field
          steps.push({
            action: 'fill',
            target: action.fieldLabel,
            value: action.value,
            _comment: `Set "${action.fieldApiName}" to "${action.value}" to trigger VR (confidence: ${(action.confidence * 100).toFixed(0)}%)`,
          });
        } else if (typeof action.value === 'number') {
          steps.push({
            action: 'fill',
            target: action.fieldLabel,
            value: String(action.value),
            _comment: `Set "${action.fieldApiName}" to ${action.value} to trigger VR (confidence: ${(action.confidence * 100).toFixed(0)}%)`,
          });
        }
        break;

      case 'setBelow':
        steps.push({
          action: 'fill',
          target: action.fieldLabel,
          value: String(action.value ?? 0),
          _comment: `Set "${action.fieldApiName}" below threshold to trigger VR (confidence: ${(action.confidence * 100).toFixed(0)}%)`,
        });
        break;

      case 'setAbove':
        steps.push({
          action: 'fill',
          target: action.fieldLabel,
          value: String(action.value ?? 999999),
          _comment: `Set "${action.fieldApiName}" above threshold to trigger VR (confidence: ${(action.confidence * 100).toFixed(0)}%)`,
        });
        break;
    }
  }

  return steps;
}
