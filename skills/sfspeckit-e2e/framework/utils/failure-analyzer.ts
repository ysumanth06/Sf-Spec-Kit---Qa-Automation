/**
 * failure-analyzer.ts — RCA Classification Engine
 *
 * Categorizes Playwright test failures into actionable RCA categories
 * so QA testers know exactly what to do when a test fails.
 *
 * Enhanced with FRAMEWORK_LIMITATION detection for the JSON DSL engine.
 */

export type FailureCategory =
  | 'SESSION'
  | 'PERMISSION'
  | 'VALIDATION'
  | 'FIELD_NOT_FOUND'
  | 'RECORD_LOCKED'
  | 'MODAL'
  | 'TIMEOUT'
  | 'SHARING'
  | 'PACKAGE'
  | 'FRAMEWORK_LIMITATION'
  | 'DATABASE_MISMATCH'
  | 'ISOLATION_DATA_CONFLICT'
  | 'ENVIRONMENT_VIEWPORT'
  | 'INFRASTRUCTURE_CACHE'
  | 'UNKNOWN';

export interface FailureAnalysis {
  category: FailureCategory;
  message: string;
  suggestedFix: string;
}

export function classifyFailure(error: unknown, pageText?: string): FailureAnalysis {
  const msg = error instanceof Error ? error.message : String(error);
  const combined = `${msg} ${pageText || ''}`.toLowerCase();

  // ── Framework Limitation (JSON DSL unknown verb) ────────
  if (/framework_limitation/i.test(msg)) {
    return {
      category: 'FRAMEWORK_LIMITATION',
      message: msg,
      suggestedFix:
        'A developer needs to add this UI interaction capability to json-runner.spec.ts. ' +
        'This is NOT a Salesforce bug.',
    };
  }

  // ── Database Verification Failure ───────────────────────
  if (/soql execution failed|database_mismatch|field .* expected/i.test(combined)) {
    return {
      category: 'DATABASE_MISMATCH',
      message: msg,
      suggestedFix:
        'The UI showed success but the database state does not match. ' +
        'Check triggers, process builders, or validation rules that may have altered the data.',
    };
  }

  // ── Session / Auth Issues ──────────────────────────────
  if (/session|login|expired|invalid session|secur\/login/i.test(combined)) {
    return {
      category: 'SESSION',
      message: msg,
      suggestedFix:
        'Increase E2E_SESSION_TIMEOUT_MINUTES or enable session refresh; verify org session settings.',
    };
  }

  // ── Permission Issues ──────────────────────────────────
  if (/insufficient|privileges|no access/i.test(combined)) {
    return {
      category: 'PERMISSION',
      message: msg,
      suggestedFix: 'Check persona Profile/PS/sharing for this object and field.',
    };
  }

  // ── Validation Rule Triggers ───────────────────────────
  if (/field_custom_validation_exception|validation rule/i.test(combined)) {
    return {
      category: 'VALIDATION',
      message: msg,
      suggestedFix: 'Adjust test data to satisfy VR or assert expected error text.',
    };
  }

  // ── Record Locked ──────────────────────────────────────
  if (/locked for editing|approval/i.test(combined)) {
    return {
      category: 'RECORD_LOCKED',
      message: msg,
      suggestedFix: 'Create a new test record not in approval.',
    };
  }

  // ── Timeout / DOM Issues ───────────────────────────────
  if (/timeout|timed out/i.test(combined)) {
    return {
      category: 'TIMEOUT',
      message: msg,
      suggestedFix:
        'Run /e2e-refresh to update selectors. ' +
        'If selectors are correct, increase actionTimeout or investigate slow org.',
    };
  }

  // ── Sharing Issues ─────────────────────────────────────
  if (/don'?t have access to this record|sharing/i.test(combined)) {
    return {
      category: 'SHARING',
      message: msg,
      suggestedFix: 'Verify OWD and sharing rules for the owning user vs persona.',
    };
  }

  // ── Package Issues ─────────────────────────────────────
  if (/app not available|package|namespace/i.test(combined)) {
    return {
      category: 'PACKAGE',
      message: msg,
      suggestedFix: 'Assign package license to persona or skip package-owned tests.',
    };
  }

  // ── Data Isolation Conflict ──────────────────────────────
  if (/unable_to_lock_row|row lock|unable to obtain exclusive access|concurrent/i.test(combined)) {
    return {
      category: 'ISOLATION_DATA_CONFLICT',
      message: msg,
      suggestedFix:
        'Test data is being shared and modified concurrently. Run /sfspeckit-e2e-discover to auto-inject dynamic data isolation.',
    };
  }

  // ── Environment Viewport ───────────────────────────────
  if (/not visible|hidden by|element is outside of the viewport/i.test(combined)) {
    return {
      category: 'ENVIRONMENT_VIEWPORT',
      message: msg,
      suggestedFix:
        'Responsive UI issue (likely CI vs local resolution). Run /sfspeckit-e2e-discover to auto-inject scrollTo or viewport adjustment.',
    };
  }

  // ── Infrastructure Cache ───────────────────────────────
  if (/stale element|is detached from dom/i.test(combined)) {
    return {
      category: 'INFRASTRUCTURE_CACHE',
      message: msg,
      suggestedFix:
        'Salesforce caching (LWS/Aura) issue causing stale DOM access. Consider adding a reload or cache wait step.',
    };
  }

  // ── Unknown ────────────────────────────────────────────
  return {
    category: 'UNKNOWN',
    message: msg,
    suggestedFix: 'Review screenshot, trace, and Salesforce debug logs.',
  };
}
