import type { Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { classifyFailure } from '../utils/failure-analyzer';
import { generateExcelReport, getLatestScreenshotPath, type TestCaseResult } from '../utils/excel-reporter';
import {
  getQaEvidenceLevel,
  shouldWriteFailureExcelReport,
  type QaEvidenceLevel,
} from '../utils/qa-config';

type Opts = { jiraId?: string; evidenceLevel?: QaEvidenceLevel };

function projectNameFromTestCase(test: TestCase): string {
  let s: Suite | undefined = test.parent;
  while (s) {
    if (s.type === 'project') return s.title;
    const proj = s.project?.();
    if (proj?.name) return proj.name;
    s = s.parent;
  }
  return '';
}

/**
 * On run end, writes Excel QA report with RCA for failed tests (when QA_EXCEL_REPORT is not 'false').
 */
export default class RcaExcelReporter implements Reporter {
  private rows: TestCaseResult[] = [];

  constructor(private options: Opts = {}) {}

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!shouldWriteFailureExcelReport()) return;
    if (result.status !== 'failed') return;

    const msg = result.error?.message || result.errors?.map((e) => e.message).join('\n') || '';
    const analysis = classifyFailure(msg, '');

    const projectName = projectNameFromTestCase(test);
    const evidenceLevel = this.options.evidenceLevel || getQaEvidenceLevel();
    const titlePath = test.titlePath();
    const testTitle = titlePath[titlePath.length - 1] || test.title;
    const screenshotPath = getLatestScreenshotPath(testTitle, projectName);

    this.rows.push({
      tcId: `AUTO-${String(this.rows.length + 1).padStart(4, '0')}`,
      title: [...test.titlePath()].join(' › '),
      profile: projectName,
      personaName: projectName,
      steps: 'See Playwright trace / stdout',
      expectedResult: 'Pass',
      actualResult: msg.slice(0, 500),
      status: 'FAIL',
      rcaCategory: analysis.category,
      notes: analysis.suggestedFix,
      duration: result.duration,
      screenshotPath: evidenceLevel === 'light' ? undefined : screenshotPath,
    });
  }

  async onEnd(): Promise<void> {
    if (!shouldWriteFailureExcelReport()) return;
    if (this.rows.length === 0) return;

    const jira = this.options.jiraId || process.env.JIRA_ID || process.env.JIRA_PREFIX;
    const evidenceLevel = this.options.evidenceLevel || getQaEvidenceLevel();
    await generateExcelReport(this.rows, {
      jiraId: jira,
      environment: process.env.E2E_JWT_INSTANCE_URL,
      embedScreenshots: evidenceLevel === 'full',
    });
  }
}
