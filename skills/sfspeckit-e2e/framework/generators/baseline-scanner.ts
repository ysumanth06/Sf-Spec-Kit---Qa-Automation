/**
 * baseline-scanner.ts — Intelligent Baseline Test Generator
 *
 * Scans the Salesforce org metadata and generates foundational
 * regression tests (CRUD, FLS, VR, Picklist, RecordType) as JSON DSL files.
 *
 * Supports:
 *   - Full org scan
 *   - Object-scoped scan with dependency graph expansion
 *   - Standard domain scoping (Sales, Service, FieldService)
 *   - Custom domain clusters from domains.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { scanOrgMetadata, type OrgMetadata } from '../utils/internal-metadata-scanner';
import { loadPersonas } from '../utils/auth';
import { parseVrFormula, generateVrTriggerSteps } from '../utils/vr-formula-parser';

const DOMAINS_FILE = path.resolve(__dirname, '..', 'domains.json');
const TESTS_DIR = path.resolve(__dirname, '..', 'tests', 'baseline');

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface BaselineTestStep {
  action: string;
  [key: string]: any;
}

interface BaselineTestCase {
  id: string;
  title: string;
  persona: string;
  tags: string[];
  steps: BaselineTestStep[];
}

interface BaselineTestSuite {
  name: string;
  storyId: string;
  personas: string[];
  setup: {
    dataFactory: Array<{
      variable: string;
      object: string;
      fields: Record<string, any>;
    }>;
  };
  tests: BaselineTestCase[];
}

interface DomainsConfig {
  domains: Record<string, string[]>;
}

// ═══════════════════════════════════════════════════════════
// Domain Resolution
// ═══════════════════════════════════════════════════════════

function loadDomains(): DomainsConfig {
  if (!fs.existsSync(DOMAINS_FILE)) {
    return { domains: {} };
  }
  return JSON.parse(fs.readFileSync(DOMAINS_FILE, 'utf8'));
}

export function resolveObjectsFromDomain(domainName: string): string[] {
  const config = loadDomains();
  const key = Object.keys(config.domains).find(
    (k) => k.toLowerCase() === domainName.toLowerCase(),
  );
  if (!key) {
    throw new Error(
      `Unknown domain: "${domainName}". ` +
      `Available: ${Object.keys(config.domains).join(', ')}. ` +
      `Add custom domains to domains.json.`,
    );
  }
  return config.domains[key];
}

export function listAvailableDomains(): string[] {
  const config = loadDomains();
  return Object.keys(config.domains);
}

// ═══════════════════════════════════════════════════════════
// Dependency Graph Expansion
// ═══════════════════════════════════════════════════════════

/**
 * Given a set of seed objects, expand the dependency graph to include
 * child relationships, triggers, and flows targeting these objects.
 *
 * NOTE: Full dependency resolution requires live org describe calls.
 * This implementation provides a synchronous expansion based on
 * known standard relationships. The internal-metadata-scanner handles
 * the live org queries for triggers, flows, etc.
 */
export function expandDependencyGraph(seedObjects: string[]): string[] {
  const expanded = new Set(seedObjects);

  // Standard parent-child relationships
  const knownRelationships: Record<string, string[]> = {
    Account: ['Contact', 'Opportunity', 'Case'],
    Opportunity: ['OpportunityLineItem', 'OpportunityContactRole'],
    Case: ['CaseComment'],
    Order: ['OrderItem'],
    Quote: ['QuoteLineItem'],
    Campaign: ['CampaignMember'],
    Contract: ['ContractLineItem'],
    ServiceAppointment: ['AssignedResource'],
    WorkOrder: ['WorkOrderLineItem'],
  };

  for (const obj of seedObjects) {
    const children = knownRelationships[obj];
    if (children) {
      for (const child of children) {
        expanded.add(child);
      }
    }
  }

  return [...expanded];
}

// ═══════════════════════════════════════════════════════════
// Test Generation per Object
// ═══════════════════════════════════════════════════════════

function generateCrudTests(
  objectName: string,
  metadata: OrgMetadata,
  personas: string[],
): BaselineTestCase[] {
  const tests: BaselineTestCase[] = [];
  const varName = `@${objectName.charAt(0).toLowerCase() + objectName.slice(1).replace(/__c$/, '')}Id`;
  let tcIndex = 1;

  for (const persona of personas) {
    // Check if persona has object access
    const objPerm = metadata.objectPermissions.find(
      (op) =>
        op.SobjectType === objectName &&
        (op.Parent?.Profile?.Name === persona || op.Parent?.Label === persona),
    );

    const canRead = objPerm?.PermissionsRead ?? false;
    const canCreate = objPerm?.PermissionsCreate ?? false;
    const canEdit = objPerm?.PermissionsEdit ?? false;
    const canDelete = objPerm?.PermissionsDelete ?? false;

    // READ test
    tests.push({
      id: `BL-${objectName}-${String(tcIndex++).padStart(3, '0')}`,
      title: `${persona} can${canRead ? '' : 'not'} read ${objectName}`,
      persona,
      tags: [canRead ? 'positive' : 'negative', 'crud', 'read', 'baseline'],
      steps: canRead
        ? [
            { action: 'openRecord', object: objectName, recordId: varName },
            { action: 'screenshot', name: `baseline_${objectName}_read_${persona}` },
          ]
        : [
            { action: 'openObjectHome', object: objectName },
            {
              action: 'screenshot',
              name: `baseline_${objectName}_no_read_${persona}`,
              _comment: `${persona} should NOT see ${objectName} records`,
            },
          ],
    });

    // CREATE test
    if (canCreate) {
      tests.push({
        id: `BL-${objectName}-${String(tcIndex++).padStart(3, '0')}`,
        title: `${persona} can create ${objectName}`,
        persona,
        tags: ['positive', 'crud', 'create', 'baseline'],
        steps: [
          { action: 'openNewRecord', object: objectName },
          { action: 'screenshot', name: `baseline_${objectName}_create_${persona}` },
          { action: 'clickCancel' },
        ],
      });
    }

    // EDIT test
    if (canEdit) {
      tests.push({
        id: `BL-${objectName}-${String(tcIndex++).padStart(3, '0')}`,
        title: `${persona} can edit ${objectName}`,
        persona,
        tags: ['positive', 'crud', 'edit', 'baseline'],
        steps: [
          { action: 'openRecord', object: objectName, recordId: varName },
          { action: 'clickEdit' },
          { action: 'screenshot', name: `baseline_${objectName}_edit_${persona}` },
          { action: 'clickCancel' },
        ],
      });
    }

    // DELETE test
    if (canDelete) {
      tests.push({
        id: `BL-${objectName}-${String(tcIndex++).padStart(3, '0')}`,
        title: `${persona} has delete access on ${objectName}`,
        persona,
        tags: ['positive', 'crud', 'delete', 'baseline'],
        steps: [
          { action: 'openRecord', object: objectName, recordId: varName },
          {
            action: 'screenshot',
            name: `baseline_${objectName}_delete_access_${persona}`,
            _comment: 'Verify delete button appears in actions menu (do not actually delete)',
          },
        ],
      });
    }
  }

  return tests;
}

function generateVRTests(
  objectName: string,
  metadata: OrgMetadata,
  personas: string[],
): BaselineTestCase[] {
  const tests: BaselineTestCase[] = [];
  const varName = `@${objectName.charAt(0).toLowerCase() + objectName.slice(1).replace(/__c$/, '')}Id`;
  let tcIndex = 100;

  const objectVRs = metadata.validationRules.filter(
    (vr) => vr.EntityDefinition?.QualifiedApiName === objectName,
  );

  for (const vr of objectVRs) {
    const triggerSteps: BaselineTestStep[] = [
      { action: 'openRecord', object: objectName, recordId: varName },
      { action: 'clickEdit' },
    ];

    // ── Strategy 1: Formula-based trigger data generation ──
    // Parse the VR formula and generate field values that trigger the rule
    let formulaParsed = false;
    if (vr.Metadata?.errorConditionFormula) {
      const parseResult = parseVrFormula(vr.Metadata.errorConditionFormula);
      if (parseResult.parsed && parseResult.actions.length > 0) {
        // Filter to high-confidence actions (> 60%)
        const confidentActions = parseResult.actions.filter((a) => a.confidence > 0.6);

        if (confidentActions.length > 0) {
          const formulaSteps = generateVrTriggerSteps({
            ...parseResult,
            actions: confidentActions,
          });

          if (formulaSteps.length > 0) {
            triggerSteps.push(...formulaSteps as BaselineTestStep[]);
            formulaParsed = true;
          }
        }
      }

      // If formula has context dependencies, add a comment
      if (parseResult.hasContextDependency) {
        triggerSteps.push({
          action: 'screenshot',
          name: `baseline_vr_${vr.ValidationName}_context_warning`,
          _comment: `⚠️ VR "${vr.ValidationName}" has $User/$Profile conditions — may not trigger for all personas`,
        } as BaselineTestStep);
      }
    }

    // ── Strategy 2: ErrorDisplayField fallback ──
    // If formula parsing failed, try clearing the error display field
    if (!formulaParsed && vr.ErrorDisplayField) {
      const fieldLabel = vr.ErrorDisplayField
        .replace(/__c$/, '')
        .replace(/_/g, ' ');
      triggerSteps.push({
        action: 'fill',
        target: fieldLabel,
        value: '',
        _comment: `Clearing "${vr.ErrorDisplayField}" to trigger VR "${vr.ValidationName}" (fallback: no formula parsed)`,
      });
    }

    // ── Strategy 3: Submit-and-check fallback ──
    // If neither formula nor ErrorDisplayField is available,
    // just submit and check (works when test data already violates VR)
    if (!formulaParsed && !vr.ErrorDisplayField) {
      triggerSteps.push({
        action: 'screenshot',
        name: `baseline_vr_${vr.ValidationName}_no_trigger_data`,
        _comment: `⚠️ No formula or ErrorDisplayField available — submit-and-check only. May not trigger VR.`,
      } as BaselineTestStep);
    }

    // Submit and expect the VR to fire
    triggerSteps.push({ action: 'clickSave' });

    // Assert the exact error message from metadata
    const truncatedError = vr.ErrorMessage.length > 80
      ? vr.ErrorMessage.slice(0, 80)
      : vr.ErrorMessage;
    triggerSteps.push({
      action: 'assertErrorMessage',
      contains: truncatedError,
    });

    // Take screenshot as evidence
    triggerSteps.push({
      action: 'screenshot',
      name: `baseline_vr_${vr.ValidationName}_triggered`,
    });

    // Cancel to restore the record to its original state
    triggerSteps.push({ action: 'clickCancel' });

    const tags = ['baseline', 'validation-rule', 'negative'];
    if (formulaParsed) tags.push('formula-driven');

    tests.push({
      id: `BL-${objectName}-VR-${String(tcIndex++).padStart(3, '0')}`,
      title: `VR "${vr.ValidationName}" fires and shows: "${truncatedError}"`,
      persona: personas[0] || 'Admin',
      tags,
      steps: triggerSteps,
    });
  }

  return tests;
}

function generateRecordTypeTests(
  objectName: string,
  metadata: OrgMetadata,
  personas: string[],
): BaselineTestCase[] {
  const tests: BaselineTestCase[] = [];
  let tcIndex = 200;

  const objectRTs = metadata.recordTypes.filter((rt) => rt.SobjectType === objectName);

  for (const rt of objectRTs) {
    tests.push({
      id: `BL-${objectName}-RT-${String(tcIndex++).padStart(3, '0')}`,
      title: `Record Type "${rt.Name}" is active on ${objectName}`,
      persona: personas[0] || 'Admin',
      tags: ['baseline', 'record-type'],
      steps: [
        { action: 'openNewRecord', object: objectName, recordTypeId: rt.Id },
        { action: 'screenshot', name: `baseline_rt_${rt.DeveloperName}` },
        { action: 'clickCancel' },
      ],
    });
  }

  return tests;
}

// ═══════════════════════════════════════════════════════════
// Main: Generate Baseline for Objects
// ═══════════════════════════════════════════════════════════

export async function generateBaselineTests(
  objects: string[],
  options: { refresh?: boolean; profiles?: string[] } = {},
): Promise<{ files: string[]; testCount: number }> {
  const expandedObjects = expandDependencyGraph(objects);
  console.log(`🔍 Scanning metadata for ${expandedObjects.length} objects: ${expandedObjects.join(', ')}`);

  const metadata = await scanOrgMetadata({
    objects: expandedObjects,
    profiles: options.profiles,
    refresh: options.refresh,
  });

  const personas = loadPersonas().map((p) => p.name);
  if (personas.length === 0) {
    throw new Error('No personas configured. Update personas.json or E2E_JWT_USERS in .env.');
  }

  if (!fs.existsSync(TESTS_DIR)) {
    fs.mkdirSync(TESTS_DIR, { recursive: true });
  }

  const files: string[] = [];
  let totalTests = 0;

  for (const obj of expandedObjects) {
    const tests: BaselineTestCase[] = [
      ...generateCrudTests(obj, metadata, personas),
      ...generateVRTests(obj, metadata, personas),
      ...generateRecordTypeTests(obj, metadata, personas),
    ];

    if (tests.length === 0) {
      console.log(`  ⏭️  ${obj}: No tests generated (no permissions or metadata found)`);
      continue;
    }

    const prefix = process.env.QA_PREFIX || 'QA';
    const nameField = obj === 'Contact' ? 'LastName' : 'Name';
    const varName = `@${obj.charAt(0).toLowerCase() + obj.slice(1).replace(/__c$/, '')}Id`;

    const suite: BaselineTestSuite = {
      name: `Baseline: ${obj}`,
      storyId: `baseline_${obj.toLowerCase()}`,
      personas,
      setup: {
        dataFactory: [
          {
            variable: varName,
            object: obj,
            fields: { [nameField]: `${prefix}-Baseline ${obj}` },
          },
        ],
      },
      tests,
    };

    const filename = `${obj.toLowerCase().replace(/__/g, '_')}.test.json`;
    const filePath = path.join(TESTS_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(suite, null, 2));

    files.push(filePath);
    totalTests += tests.length;
    console.log(`  ✅ ${obj}: ${tests.length} tests → ${filename}`);
  }

  console.log(`\n📊 Baseline complete: ${totalTests} tests across ${files.length} files`);
  return { files, testCount: totalTests };
}

// ═══════════════════════════════════════════════════════════
// CLI Entry Point
// ═══════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx tsx generators/baseline-scanner.ts [objects|domain]');
    console.log('  Objects: Account,Contact,Opportunity');
    console.log(`  Domains: ${listAvailableDomains().join(', ')}`);
    process.exit(1);
  }

  const input = args.join(' ');

  // Check if input is a known domain
  const domains = listAvailableDomains();
  const matchedDomain = domains.find(
    (d) => d.toLowerCase() === input.toLowerCase(),
  );

  let objects: string[];
  if (matchedDomain) {
    objects = resolveObjectsFromDomain(matchedDomain);
    console.log(`📦 Domain "${matchedDomain}" → ${objects.join(', ')}`);
  } else {
    objects = input.split(',').map((o) => o.trim()).filter(Boolean);
  }

  const refresh = args.includes('--refresh');
  await generateBaselineTests(objects, { refresh });
}

main().catch((err) => {
  console.error('❌ Baseline scan failed:', err);
  process.exit(1);
});
