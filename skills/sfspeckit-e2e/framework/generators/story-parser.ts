/**
 * story-parser.ts — SFSpeckit Story Markdown Parser
 *
 * Reads an SFSpeckit developer story file and extracts structured
 * data for JSON test generation. This is the AI's input processor.
 *
 * The AI calls this module to understand what needs to be tested
 * before generating the JSON DSL test files.
 */

import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface AcceptanceCriterion {
  id: string;
  given: string;
  when: string;
  then: string;
  raw: string;
}

export interface SecurityMatrixEntry {
  persona: string;
  profile: string;
  objectAccess: string;
  fieldAccess: string;
  expectedResult: 'ALLOW' | 'DENY';
}

export interface TestCase {
  type: 'positive' | 'negative' | 'bulk';
  description: string;
  relatedAC?: string;
}

export interface ImplementationLayer {
  layer: string;
  skill: string;
  filePath: string;
  status: string;
}

export interface ParsedStory {
  storyId: string;
  title: string;
  description: string;
  storyType: 'FULL' | 'DECLARATIVE';
  status: string;
  acceptanceCriteria: AcceptanceCriterion[];
  securityMatrix: SecurityMatrixEntry[];
  testCases: TestCase[];
  implementationLayers: ImplementationLayer[];
  dependencies: string[];
  objects: string[];
  flows: string[];
  lwcComponents: string[];
  apexClasses: string[];
  rawContent: string;
}

// ═══════════════════════════════════════════════════════════
// Markdown Parsing Helpers
// ═══════════════════════════════════════════════════════════

function extractSection(content: string, heading: string): string {
  const headingPattern = new RegExp(
    `^#{1,4}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
    'im',
  );
  const match = content.match(headingPattern);
  if (!match || match.index === undefined) return '';

  const startIdx = match.index + match[0].length;
  const nextHeading = content.slice(startIdx).search(/^#{1,4}\s+/m);
  const endIdx = nextHeading === -1 ? content.length : startIdx + nextHeading;

  return content.slice(startIdx, endIdx).trim();
}

function extractStoryId(content: string): string {
  // Try to match "Task Story 01" or "task_story_01" from filename references or title
  const match =
    content.match(/task[_\s]story[_\s](\d+)/i) ||
    content.match(/TS-(\d+)/i) ||
    content.match(/Story[:\s]+(\d+)/i);
  return match ? `TS-${match[1].padStart(2, '0')}` : 'TS-XX';
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled Story';
}

function extractStatus(content: string): string {
  const statusSection = extractSection(content, 'Status');
  const match = statusSection.match(/State[:\s]+(\w+)/i);
  return match ? match[1] : 'UNKNOWN';
}

function extractStoryType(content: string): 'FULL' | 'DECLARATIVE' {
  const match = content.match(/Story\s+Type[:\s]+(FULL|DECLARATIVE)/i);
  return match ? (match[1].toUpperCase() as 'FULL' | 'DECLARATIVE') : 'FULL';
}

// ═══════════════════════════════════════════════════════════
// Acceptance Criteria Parser
// ═══════════════════════════════════════════════════════════

export function parseAcceptanceCriteria(content: string): AcceptanceCriterion[] {
  const acSection = extractSection(content, 'Acceptance Criteria') ||
                    extractSection(content, 'Detailed Acceptance Criteria');
  if (!acSection) return [];

  const criteria: AcceptanceCriterion[] = [];
  let acIndex = 1;

  // Match Given/When/Then blocks
  const gwt = acSection.matchAll(
    /(?:AC-?\d*\.?\s*)?(?:\*\*)?Given(?:\*\*)?[:\s]+(.+?)[\n\r]+\s*(?:\*\*)?When(?:\*\*)?[:\s]+(.+?)[\n\r]+\s*(?:\*\*)?Then(?:\*\*)?[:\s]+(.+?)(?=\n\s*(?:(?:\*\*)?Given|\n#{1,4}\s|$))/gis,
  );

  for (const m of gwt) {
    criteria.push({
      id: `AC-${acIndex}`,
      given: m[1].trim(),
      when: m[2].trim(),
      then: m[3].trim(),
      raw: m[0].trim(),
    });
    acIndex++;
  }

  // Fallback: numbered bullet points that aren't GWT format
  if (criteria.length === 0) {
    const bullets = acSection.matchAll(/[-*]\s+(.+)/g);
    for (const b of bullets) {
      criteria.push({
        id: `AC-${acIndex}`,
        given: 'See description',
        when: 'See description',
        then: b[1].trim(),
        raw: b[0].trim(),
      });
      acIndex++;
    }
  }

  return criteria;
}

// ═══════════════════════════════════════════════════════════
// Security Matrix Parser
// ═══════════════════════════════════════════════════════════

export function parseSecurityMatrix(content: string): SecurityMatrixEntry[] {
  const section = extractSection(content, 'Security & Access Matrix') ||
                  extractSection(content, 'Security Matrix');
  if (!section) return [];

  const entries: SecurityMatrixEntry[] = [];

  // Parse markdown table rows
  const tableRows = section.matchAll(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g);
  let isHeader = true;

  for (const row of tableRows) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    // Skip separator rows
    if (row[1].trim().startsWith('-')) continue;

    entries.push({
      persona: row[1].trim(),
      profile: row[1].trim(),
      objectAccess: row[2].trim(),
      fieldAccess: row[3].trim(),
      expectedResult: row[4].trim().toLowerCase().includes('deny') ? 'DENY' : 'ALLOW',
    });
  }

  return entries;
}

// ═══════════════════════════════════════════════════════════
// Test Cases Parser
// ═══════════════════════════════════════════════════════════

export function parseTestCases(content: string): TestCase[] {
  const cases: TestCase[] = [];

  for (const type of ['positive', 'negative', 'bulk'] as const) {
    const section = extractSection(content, type.charAt(0).toUpperCase() + type.slice(1));
    if (!section) continue;

    const bullets = section.matchAll(/[-*]\s+(.+)/g);
    for (const b of bullets) {
      cases.push({
        type,
        description: b[1].trim(),
      });
    }
  }

  // If no separate sections, look for a combined "Test Cases" section
  if (cases.length === 0) {
    const combined = extractSection(content, 'Test Cases');
    if (combined) {
      const bullets = combined.matchAll(/[-*]\s+(.+)/g);
      for (const b of bullets) {
        const desc = b[1].trim().toLowerCase();
        const type: TestCase['type'] = desc.includes('negative') || desc.includes('error') || desc.includes('denied')
          ? 'negative'
          : desc.includes('bulk') || desc.includes('251')
            ? 'bulk'
            : 'positive';
        cases.push({ type, description: b[1].trim() });
      }
    }
  }

  return cases;
}

// ═══════════════════════════════════════════════════════════
// Implementation Layers Parser
// ═══════════════════════════════════════════════════════════

export function parseImplementationLayers(content: string): ImplementationLayer[] {
  const section = extractSection(content, 'SF Implementation Layers') ||
                  extractSection(content, 'Implementation Layers');
  if (!section) return [];

  const layers: ImplementationLayer[] = [];
  const tableRows = section.matchAll(
    /\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g,
  );
  let isHeader = true;

  for (const row of tableRows) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    if (row[1].trim().startsWith('-')) continue;

    layers.push({
      layer: row[1].trim(),
      skill: row[2].trim(),
      filePath: row[3].trim(),
      status: row[4].trim(),
    });
  }

  return layers;
}

// ═══════════════════════════════════════════════════════════
// Object & Metadata Extraction
// ═══════════════════════════════════════════════════════════

export function extractReferencedObjects(content: string): string[] {
  const objects = new Set<string>();

  // Match standard Salesforce object patterns
  const apiNamePattern = /\b([A-Z][a-zA-Z_]*(?:__c|__mdt|__e|__b))\b/g;
  let match;
  while ((match = apiNamePattern.exec(content)) !== null) {
    objects.add(match[1]);
  }

  // Match standard objects mentioned explicitly
  const standardObjects = [
    'Account', 'Contact', 'Lead', 'Opportunity', 'Case',
    'Campaign', 'Task', 'Event', 'Quote', 'Order',
    'Product2', 'Pricebook2', 'Contract', 'Solution',
  ];
  for (const obj of standardObjects) {
    if (content.includes(obj)) {
      objects.add(obj);
    }
  }

  return [...objects];
}

export function extractReferencedFlows(content: string): string[] {
  const flows = new Set<string>();
  const pattern = /\b([A-Z][a-zA-Z_]*_Flow[a-zA-Z_]*|[A-Z][a-zA-Z_]*_Auto[a-zA-Z_]*)\b/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    flows.add(match[1]);
  }

  // Also look for flow names in implementation layers
  const flowReferences = content.matchAll(/flow[:\s]+([A-Za-z_]+)/gi);
  for (const ref of flowReferences) {
    flows.add(ref[1]);
  }

  return [...flows];
}

export function extractReferencedApexClasses(content: string): string[] {
  const classes = new Set<string>();

  // Match .cls file references
  const clsPattern = /\b([A-Z][a-zA-Z_]*(?:Controller|Service|Selector|Handler|Helper|Factory|Test|Batch|Trigger))\b/g;
  let match;
  while ((match = clsPattern.exec(content)) !== null) {
    classes.add(match[1]);
  }

  return [...classes];
}

export function extractReferencedLwcComponents(content: string): string[] {
  const components = new Set<string>();

  // Match LWC component names (camelCase)
  const lwcPattern = /\b([a-z][a-zA-Z]*(?:Grid|Table|Form|Modal|Card|Page|Component|Widget))\b/g;
  let match;
  while ((match = lwcPattern.exec(content)) !== null) {
    components.add(match[1]);
  }

  return [...components];
}

// ═══════════════════════════════════════════════════════════
// Main Parser
// ═══════════════════════════════════════════════════════════

export function parseStoryFile(filePath: string): ParsedStory {
  const content = fs.readFileSync(filePath, 'utf8');

  return {
    storyId: extractStoryId(content),
    title: extractTitle(content),
    description: extractSection(content, 'Description') || extractSection(content, 'Detailed Description') || '',
    storyType: extractStoryType(content),
    status: extractStatus(content),
    acceptanceCriteria: parseAcceptanceCriteria(content),
    securityMatrix: parseSecurityMatrix(content),
    testCases: parseTestCases(content),
    implementationLayers: parseImplementationLayers(content),
    dependencies: [],
    objects: extractReferencedObjects(content),
    flows: extractReferencedFlows(content),
    lwcComponents: extractReferencedLwcComponents(content),
    apexClasses: extractReferencedApexClasses(content),
    rawContent: content,
  };
}

/**
 * Quick summary for logging/confirmation before generation.
 */
export function summarizeParsedStory(story: ParsedStory): string {
  return [
    `📖 Story: ${story.storyId} — ${story.title}`,
    `   Type: ${story.storyType} | Status: ${story.status}`,
    `   ACs: ${story.acceptanceCriteria.length}`,
    `   Personas: ${story.securityMatrix.length}`,
    `   Test Cases: ${story.testCases.length}`,
    `   Objects: ${story.objects.join(', ') || 'none detected'}`,
    `   Flows: ${story.flows.join(', ') || 'none detected'}`,
    `   Apex: ${story.apexClasses.join(', ') || 'none detected'}`,
  ].join('\n');
}
