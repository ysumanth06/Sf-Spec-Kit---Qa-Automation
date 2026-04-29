import * as fs from 'fs';
import * as path from 'path';

export type QaRuntimeMode = 'headed' | 'headless';
export type QaEvidenceLevel = 'light' | 'normal' | 'full';

export interface QaConfig {
  defaultMode: QaRuntimeMode;
  runPrecheck: boolean;
  defaultEvidence: QaEvidenceLevel;
  defaultWorkers: number;
  persistTestData: boolean;
  autoCleanupDays: number;
  generateExcelOnFailureOnly: boolean;
  useMcpForAuthoringOnly: boolean;
  defaultObjects: string[];
}

const ROOT_DIR = path.resolve(__dirname, '..');
export const QA_CONFIG_PATH = path.join(ROOT_DIR, 'config', 'qa.config.json');
export const QA_CONFIG_EXAMPLE_PATH = path.join(ROOT_DIR, 'config', 'qa.config.example.json');

const DEFAULT_QA_CONFIG: QaConfig = {
  defaultMode: 'headed',
  runPrecheck: true,
  defaultEvidence: 'normal',
  defaultWorkers: 1,
  persistTestData: true,
  autoCleanupDays: 7,
  generateExcelOnFailureOnly: true,
  useMcpForAuthoringOnly: true,
  defaultObjects: ['Account', 'Contact'],
};

let cachedConfig: QaConfig | null = null;

function splitCsv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function toNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toMode(value: unknown, fallback: QaRuntimeMode): QaRuntimeMode {
  return value === 'headless' || value === 'headed' ? value : fallback;
}

function toEvidenceLevel(value: unknown, fallback: QaEvidenceLevel): QaEvidenceLevel {
  return value === 'light' || value === 'normal' || value === 'full' ? value : fallback;
}

function readJsonFile(filePath: string): Partial<QaConfig> | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as Partial<QaConfig>;
  } catch {
    return null;
  }
}

function normalizeConfig(raw: Partial<QaConfig> | null | undefined): QaConfig {
  const merged = { ...DEFAULT_QA_CONFIG, ...(raw || {}) };

  return {
    defaultMode: toMode(merged.defaultMode, DEFAULT_QA_CONFIG.defaultMode),
    runPrecheck: Boolean(merged.runPrecheck),
    defaultEvidence: toEvidenceLevel(merged.defaultEvidence, DEFAULT_QA_CONFIG.defaultEvidence),
    defaultWorkers: Number.isFinite(merged.defaultWorkers)
      ? Number(merged.defaultWorkers)
      : DEFAULT_QA_CONFIG.defaultWorkers,
    persistTestData: Boolean(merged.persistTestData),
    autoCleanupDays: Number.isFinite(merged.autoCleanupDays)
      ? Number(merged.autoCleanupDays)
      : DEFAULT_QA_CONFIG.autoCleanupDays,
    generateExcelOnFailureOnly: Boolean(merged.generateExcelOnFailureOnly),
    useMcpForAuthoringOnly: Boolean(merged.useMcpForAuthoringOnly),
    defaultObjects:
      Array.isArray(merged.defaultObjects) && merged.defaultObjects.length > 0
        ? merged.defaultObjects.map((value) => String(value).trim()).filter(Boolean)
        : [...DEFAULT_QA_CONFIG.defaultObjects],
  };
}

function readDiskConfig(): Partial<QaConfig> | null {
  return readJsonFile(QA_CONFIG_PATH) ?? readJsonFile(QA_CONFIG_EXAMPLE_PATH);
}

function applyEnvOverrides(config: QaConfig): QaConfig {
  const headedEnv = process.env.HEADED?.trim().toLowerCase();
  const evidenceEnv = process.env.QA_EVIDENCE_LEVEL?.trim().toLowerCase();
  const defaultObjects = splitCsv(process.env.DEFAULT_OBJECTS);

  return {
    defaultMode:
      headedEnv === 'true'
        ? 'headed'
        : headedEnv === 'false'
          ? 'headless'
          : config.defaultMode,
    runPrecheck: toBoolean(process.env.QA_RUN_PRECHECK, config.runPrecheck),
    defaultEvidence: toEvidenceLevel(evidenceEnv, config.defaultEvidence),
    defaultWorkers: toNumber(process.env.WORKERS, config.defaultWorkers),
    persistTestData: toBoolean(process.env.QA_PERSIST_TEST_DATA, config.persistTestData),
    autoCleanupDays: toNumber(process.env.QA_AUTO_CLEANUP_DAYS, config.autoCleanupDays),
    generateExcelOnFailureOnly: toBoolean(
      process.env.QA_GENERATE_EXCEL_ON_FAILURE_ONLY,
      config.generateExcelOnFailureOnly,
    ),
    useMcpForAuthoringOnly: toBoolean(process.env.QA_USE_MCP_FOR_AUTHORING_ONLY, config.useMcpForAuthoringOnly),
    defaultObjects: defaultObjects ?? config.defaultObjects,
  };
}

export function loadQaConfig(): QaConfig {
  if (cachedConfig) return cachedConfig;
  cachedConfig = applyEnvOverrides(normalizeConfig(readDiskConfig()));
  return cachedConfig;
}

export function resetQaConfigCache(): void {
  cachedConfig = null;
}

export function getQaConfig(): QaConfig {
  return loadQaConfig();
}

export function getQaDefaultObjects(): string[] {
  return [...loadQaConfig().defaultObjects];
}

export function getQaWorkers(): number {
  return loadQaConfig().defaultWorkers;
}

export function isQaHeaded(): boolean {
  return loadQaConfig().defaultMode === 'headed';
}

export function getQaEvidenceLevel(): QaEvidenceLevel {
  return loadQaConfig().defaultEvidence;
}

export function shouldRunPrecheck(): boolean {
  return loadQaConfig().runPrecheck;
}

export function shouldPersistTestData(): boolean {
  return loadQaConfig().persistTestData;
}

export function getQaAutoCleanupDays(): number {
  return loadQaConfig().autoCleanupDays;
}

export function shouldWriteFailureExcelReport(): boolean {
  const env = process.env.QA_EXCEL_REPORT?.trim().toLowerCase();
  if (env === 'false' || env === '0' || env === 'no') return false;
  if (env === 'true' || env === '1' || env === 'yes') return true;
  return loadQaConfig().generateExcelOnFailureOnly;
}

export function shouldEmbedExcelScreenshots(): boolean {
  return getQaEvidenceLevel() === 'full';
}

export function shouldCaptureWorkspaceScreenshots(): boolean {
  return getQaEvidenceLevel() !== 'light';
}

export function shouldUseMcpForAuthoringOnly(): boolean {
  return loadQaConfig().useMcpForAuthoringOnly;
}

export function getQaConfigSummary(): string {
  const config = loadQaConfig();
  return [
    `mode=${config.defaultMode}`,
    `evidence=${config.defaultEvidence}`,
    `workers=${config.defaultWorkers}`,
    `precheck=${config.runPrecheck ? 'on' : 'off'}`,
    `cleanupDays=${config.autoCleanupDays}`,
    `excel=${config.generateExcelOnFailureOnly ? 'on-failure' : 'off'}`,
  ].join(', ');
}
