/**
 * generators/index.ts — Barrel Export for AI-Driven Generators
 *
 * Exposes the story parser, JSON test generator, and baseline scanner
 * for use by the AI slash command handlers.
 */

export { parseStoryFile, summarizeParsedStory } from './story-parser';
export type { ParsedStory, AcceptanceCriterion, SecurityMatrixEntry } from './story-parser';

export { generateTestSuite, generateAndSaveTestFile } from './json-test-generator';

export {
  generateBaselineTests,
  resolveObjectsFromDomain,
  listAvailableDomains,
  expandDependencyGraph,
} from './baseline-scanner';
