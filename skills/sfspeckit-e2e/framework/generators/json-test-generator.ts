/**
 * json-test-generator.ts — JSON DSL Test File Generator
 *
 * Takes a parsed SFSpeckit story and generates structured JSON test files
 * that the json-runner.spec.ts engine can execute.
 *
 * This is the core AI-assisted generator. The AI calls this module
 * to translate Given/When/Then acceptance criteria into executable
 * JSON DSL steps.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  ParsedStory,
  AcceptanceCriterion,
  SecurityMatrixEntry,
} from './story-parser';
import type { OrgMetadata } from '../utils/internal-metadata-scanner';

// ═══════════════════════════════════════════════════════════
// Types (JSON DSL Output)
// ═══════════════════════════════════════════════════════════

interface TestStep {
  action: string;
  [key: string]: any;
}

interface TestCase {
  id: string;
  title: string;
  persona: string;
  tags: string[];
  steps: TestStep[];
}

interface DataFactoryItem {
  variable: string;
  object: string;
  fields: Record<string, any>;
}

interface TestSuite {
  name: string;
  storyId: string;
  personas: string[];
  setup: {
    dataFactory: DataFactoryItem[];
    apex?: string;
  };
  tests: TestCase[];
}

// ═══════════════════════════════════════════════════════════
// Step Generation Helpers
// ═══════════════════════════════════════════════════════════

function generateSetupData(story: ParsedStory): DataFactoryItem[] {
  const items: DataFactoryItem[] = [];
  const prefix = process.env.QA_PREFIX || 'QA';

  for (const obj of story.objects) {
    // Skip metadata types
    if (obj.endsWith('__mdt') || obj.endsWith('__e') || obj.endsWith('__b')) continue;

    const varName = `@${obj.charAt(0).toLowerCase() + obj.slice(1).replace(/__c$/, '')}Id`;
    const nameField = obj === 'Contact' ? 'LastName' : 'Name';

    items.push({
      variable: varName,
      object: obj,
      fields: {
        [nameField]: `${prefix}-E2E ${obj} ${Date.now()}`,
      },
    });
  }

  return items;
}

function acToSteps(
  ac: AcceptanceCriterion,
  story: ParsedStory,
  metadata: OrgMetadata | null,
): TestStep[] {
  const steps: TestStep[] = [];
  const given = ac.given.toLowerCase();
  const when = ac.when.toLowerCase();
  const then = ac.then.toLowerCase();

  // ── Given: Navigation Context ────────────────────────────
  if (given.includes('record') || given.includes('view')) {
    const obj = story.objects[0] || 'Account';
    const varName = `@${obj.charAt(0).toLowerCase() + obj.slice(1).replace(/__c$/, '')}Id`;
    steps.push({ action: 'openRecord', object: obj, recordId: varName });
  } else if (given.includes('new') || given.includes('create')) {
    const obj = story.objects[0] || 'Account';
    steps.push({ action: 'openNewRecord', object: obj });
  } else if (given.includes('list') || given.includes('home')) {
    const obj = story.objects[0] || 'Account';
    steps.push({ action: 'openObjectHome', object: obj });
  } else if (given.includes('flow')) {
    const flow = story.flows[0] || 'Unknown_Flow';
    steps.push({ action: 'launchFlow', flowApiName: flow });
  }

  // ── When: User Actions ───────────────────────────────────
  if (when.includes('edit') || when.includes('change') || when.includes('update')) {
    steps.push({ action: 'clickEdit' });

    // Try to extract field and value from the When clause
    const fieldMatch = when.match(/(?:change|set|update|edit)\s+(?:the\s+)?["']?([^"']+?)["']?\s+(?:to|=|as)\s+["']?([^"']+?)["']?$/i);
    if (fieldMatch) {
      steps.push({ action: 'fill', target: fieldMatch[1].trim(), value: fieldMatch[2].trim() });
    }
  }

  if (when.includes('save') || when.includes('click save')) {
    steps.push({ action: 'clickSave' });
  }

  if (when.includes('delete')) {
    steps.push({ action: 'clickDelete' });
  }

  // ── Then: Assertions ─────────────────────────────────────
  if (then.includes('success') || then.includes('saved') || then.includes('toast')) {
    steps.push({ action: 'assertToast', contains: 'was saved' });
  }

  if (then.includes('error') || then.includes('validation')) {
    const errorMatch = then.match(/(?:error|message)\s+["']([^"']+)["']/i);
    steps.push({
      action: 'assertErrorMessage',
      contains: errorMatch ? errorMatch[1] : 'error',
    });
  }

  if (then.includes('visible') || then.includes('displayed')) {
    const fieldMatch = then.match(/["']([^"']+)["']\s+(?:is\s+)?(?:visible|displayed)/i);
    if (fieldMatch) {
      steps.push({ action: 'assertFieldVisible', target: fieldMatch[1], visible: true });
    }
  }

  if (then.includes('not visible') || then.includes('hidden')) {
    const fieldMatch = then.match(/["']([^"']+)["']\s+(?:is\s+)?(?:not visible|hidden)/i);
    if (fieldMatch) {
      steps.push({ action: 'assertFieldVisible', target: fieldMatch[1], visible: false });
    }
  }

  if (then.includes('required') || then.includes('mandatory')) {
    const fieldMatch = then.match(/["']([^"']+)["']\s+(?:becomes?\s+)?(?:required|mandatory)/i);
    if (fieldMatch) {
      steps.push({ action: 'assertFieldRequired', target: fieldMatch[1], required: true });
    }
  }

  if (then.includes('database') || then.includes('record is updated')) {
    const obj = story.objects[0] || 'Account';
    const varName = `@${obj.charAt(0).toLowerCase() + obj.slice(1).replace(/__c$/, '')}Id`;
    steps.push({
      action: 'verifyDatabase',
      query: `SELECT Id FROM ${obj} WHERE Id = '${varName}'`,
      expect: { Id: '!= null' },
      _comment: 'AI should refine this query based on the specific field being validated',
    });
  }

  // If no steps were generated for Then, add a screenshot as evidence
  if (steps.length > 0 && !steps.some((s) => s.action.startsWith('assert') || s.action === 'verifyDatabase')) {
    steps.push({ action: 'screenshot', name: `${ac.id}_evidence` });
  }

  return steps;
}

// ═══════════════════════════════════════════════════════════
// Metadata-Enriched Test Generation
// ═══════════════════════════════════════════════════════════

function generateValidationRuleTests(
  story: ParsedStory,
  metadata: OrgMetadata,
  personas: string[],
): TestCase[] {
  const tests: TestCase[] = [];
  let tcIndex = 100;

  for (const vr of metadata.validationRules) {
    const persona = personas[0] || 'Admin';
    const obj = vr.EntityDefinition?.QualifiedApiName || story.objects[0] || 'Account';
    const varName = `@${obj.charAt(0).toLowerCase() + obj.slice(1).replace(/__c$/, '')}Id`;

    tests.push({
      id: `TC-${tcIndex++}`,
      title: `[Metadata] VR "${vr.ValidationName}" triggers with invalid data`,
      persona,
      tags: ['negative', 'validation-rule', 'metadata-enriched'],
      steps: [
        { action: 'openRecord', object: obj, recordId: varName },
        { action: 'clickEdit' },
        { action: 'clickSave' },
        {
          action: 'assertErrorMessage',
          contains: vr.ErrorMessage.slice(0, 50),
          _comment: `Validation Rule: ${vr.ValidationName}. Full message: ${vr.ErrorMessage}`,
        },
      ],
    });
  }

  return tests;
}

function generatePicklistTests(
  story: ParsedStory,
  metadata: OrgMetadata,
  personas: string[],
): TestCase[] {
  const tests: TestCase[] = [];
  let tcIndex = 200;

  for (const pl of metadata.picklists) {
    if (!story.objects.includes(pl.objectApiName)) continue;
    if (pl.values.length === 0) continue;

    const persona = personas[0] || 'Admin';
    const label = pl.fieldApiName.replace(/__c$/, '').replace(/_/g, ' ');
    const obj = pl.objectApiName;
    const varName = `@${obj.charAt(0).toLowerCase() + obj.slice(1).replace(/__c$/, '')}Id`;

    // Test that each active value can be selected
    const activeValues = pl.values.filter((v) => v.isActive).slice(0, 3); // Limit to 3 for performance
    for (const val of activeValues) {
      tests.push({
        id: `TC-${tcIndex++}`,
        title: `[Metadata] Picklist "${label}" accepts value "${val.label}"`,
        persona,
        tags: ['positive', 'picklist', 'metadata-enriched'],
        steps: [
          { action: 'openRecord', object: obj, recordId: varName },
          { action: 'clickEdit' },
          { action: 'selectPicklist', target: label, value: val.label },
          { action: 'clickSave' },
          { action: 'assertToast', contains: 'was saved' },
        ],
      });
    }
  }

  return tests;
}

function generateFLSTests(
  story: ParsedStory,
  metadata: OrgMetadata,
  personas: string[],
): TestCase[] {
  const tests: TestCase[] = [];
  let tcIndex = 300;

  // Group field permissions by profile
  const profileFields = new Map<string, Set<string>>();
  for (const fp of metadata.fieldPermissions) {
    if (!story.objects.includes(fp.SobjectType)) continue;
    const profileName = fp.Parent?.Profile?.Name;
    if (!profileName) continue;

    if (!profileFields.has(profileName)) {
      profileFields.set(profileName, new Set());
    }
    if (fp.PermissionsRead) {
      profileFields.get(profileName)!.add(`${fp.SobjectType}.${fp.Field}`);
    }
  }

  // For each persona, check if fields are visible
  for (const persona of personas) {
    const fields = profileFields.get(persona);
    if (!fields || fields.size === 0) continue;

    const obj = story.objects[0] || 'Account';
    const varName = `@${obj.charAt(0).toLowerCase() + obj.slice(1).replace(/__c$/, '')}Id`;
    const sampleFields = [...fields].slice(0, 5); // Limit to 5

    tests.push({
      id: `TC-${tcIndex++}`,
      title: `[Metadata] ${persona} can see expected fields on ${obj}`,
      persona,
      tags: ['positive', 'fls', 'metadata-enriched'],
      steps: [
        { action: 'openRecord', object: obj, recordId: varName },
        ...sampleFields.map((f) => ({
          action: 'assertFieldVisible' as const,
          target: f.split('.').pop()!.replace(/__c$/, '').replace(/_/g, ' '),
          visible: true,
        })),
      ],
    });
  }

  return tests;
}

// ═══════════════════════════════════════════════════════════
// Main Generator
// ═══════════════════════════════════════════════════════════

export function generateTestSuite(
  story: ParsedStory,
  metadata: OrgMetadata | null,
): TestSuite {
  const personas = story.securityMatrix.length > 0
    ? [...new Set(story.securityMatrix.map((s) => s.persona))]
    : ['Admin'];

  const tests: TestCase[] = [];
  let tcIndex = 1;

  // ── AC-Based Tests ──────────────────────────────────────
  for (const ac of story.acceptanceCriteria) {
    for (const persona of personas) {
      const entry = story.securityMatrix.find((s) => s.persona === persona);
      const isNegativePersona = entry?.expectedResult === 'DENY';

      tests.push({
        id: `TC-${String(tcIndex++).padStart(3, '0')}`,
        title: `${persona} — ${ac.id}: ${isNegativePersona ? '[DENY] ' : ''}${ac.then.slice(0, 80)}`,
        persona,
        tags: [
          isNegativePersona ? 'negative' : 'positive',
          ac.id.toLowerCase(),
          ...(isNegativePersona ? ['permission-denied'] : []),
        ],
        steps: isNegativePersona
          ? [
              ...acToSteps(ac, story, metadata).filter((s) => s.action.startsWith('open') || s.action === 'clickEdit'),
              {
                action: 'assertFieldEditable',
                target: 'any',
                editable: false,
                _comment: `${persona} should NOT have access per Security Matrix`,
              },
            ]
          : acToSteps(ac, story, metadata),
      });
    }
  }

  // ── Story Test Cases (Positive/Negative/Bulk) ───────────
  for (const tc of story.testCases) {
    tests.push({
      id: `TC-${String(tcIndex++).padStart(3, '0')}`,
      title: `[${tc.type.toUpperCase()}] ${tc.description.slice(0, 100)}`,
      persona: personas[0],
      tags: [tc.type, 'story-test-case'],
      steps: [
        { action: 'screenshot', name: `TC-${tcIndex}_placeholder` },
        {
          action: 'wait',
          ms: 1000,
          _comment: `AI should expand this test case: "${tc.description}". ` +
                    `Use the JSON DSL actions from SKILL.md.`,
        },
      ],
    });
  }

  // ── Metadata-Enriched Tests ─────────────────────────────
  if (metadata) {
    tests.push(...generateValidationRuleTests(story, metadata, personas));
    tests.push(...generatePicklistTests(story, metadata, personas));
    tests.push(...generateFLSTests(story, metadata, personas));
  }

  return {
    name: `Story ${story.storyId}: ${story.title}`,
    storyId: story.storyId.replace(/[^a-zA-Z0-9-_]/g, '_'),
    personas,
    setup: {
      dataFactory: generateSetupData(story),
    },
    tests,
  };
}

/**
 * Generate and save the JSON test file for a story.
 */
export function generateAndSaveTestFile(
  story: ParsedStory,
  metadata: OrgMetadata | null,
  outputDir?: string,
): string {
  const suite = generateTestSuite(story, metadata);
  const dir = outputDir || path.resolve(__dirname, '..', 'tests', 'stories');

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filename = `${suite.storyId.toLowerCase().replace(/\s+/g, '_')}.test.json`;
  const filePath = path.join(dir, filename);

  fs.writeFileSync(filePath, JSON.stringify(suite, null, 2));
  console.log(`✅ Generated: ${filePath} (${suite.tests.length} tests)`);

  return filePath;
}
