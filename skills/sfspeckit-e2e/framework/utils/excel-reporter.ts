import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'screenshots');

export interface TestCaseResult {
  tcId: string;
  title: string;
  /** Salesforce profile (expected.profile) — backward compatible column */
  profile: string;
  /** Playwright persona / project name when using personas.json */
  personaName?: string;
  expectedRole?: string;
  permissionSets?: string;
  steps: string;
  expectedResult: string;
  actualResult: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  screenshotPath?: string;
  notes?: string;
  duration?: number;
  /** failure-analyzer category */
  rcaCategory?: string;
}

export interface ReportOptions {
  jiraId?: string;
  testerName?: string;
  environment?: string;
  openAfter?: boolean;
  embedScreenshots?: boolean;
}

export async function generateExcelReport(
  testResults: TestCaseResult[],
  options: ReportOptions = {}
): Promise<string> {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.testerName || process.env.QA_PREFIX || 'QA Automation';
  workbook.created = new Date();

  buildSummarySheet(workbook, testResults, options);
  await buildTestCasesSheet(workbook, testResults, options);

  const dateStr = new Date().toISOString().split('T')[0];
  const prefix = options.jiraId ? `${options.jiraId}-` : '';
  const filename = `${prefix}QA-Report-${dateStr}.xlsx`;
  const filepath = path.join(REPORTS_DIR, filename);

  await workbook.xlsx.writeFile(filepath);
  console.log(`\nExcel report generated: ${filepath}`);

  return filepath;
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  results: TestCaseResult[],
  options: ReportOptions
): void {
  const sheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: '4472C4' } },
  });

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  const skipCount = results.filter((r) => r.status === 'SKIP').length;
  const totalCount = results.length;

  const headerFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4472C4' },
  };
  const headerFont: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: 'FFFFFF' },
    size: 12,
  };

  sheet.columns = [
    { header: 'Field', key: 'field', width: 25 },
    { header: 'Value', key: 'value', width: 50 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center' };
  });

  const summaryData = [
    ['Jira Story', options.jiraId || 'N/A'],
    ['Test Date', new Date().toLocaleString()],
    ['Tester', options.testerName || process.env.QA_PREFIX || 'QA Automation'],
    ['Environment', options.environment || process.env.E2E_JWT_INSTANCE_URL || 'QA Sandbox'],
    ['', ''],
    ['Total Tests', totalCount.toString()],
    ['Passed', passCount.toString()],
    ['Failed', failCount.toString()],
    ['Skipped', skipCount.toString()],
    ['Pass Rate', totalCount > 0 ? `${Math.round((passCount / totalCount) * 100)}%` : 'N/A'],
    ['', ''],
    ['Overall Result', failCount === 0 ? 'PASS' : 'FAIL'],
  ];

  for (const [field, value] of summaryData) {
    const row = sheet.addRow({ field, value });
    if (field === 'Overall Result') {
      const valueCell = row.getCell('value');
      valueCell.font = { bold: true, size: 14, color: { argb: failCount === 0 ? '00B050' : 'FF0000' } };
    }
    if (field === 'Passed') {
      row.getCell('value').font = { color: { argb: '00B050' }, bold: true };
    }
    if (field === 'Failed') {
      row.getCell('value').font = { color: { argb: 'FF0000' }, bold: true };
    }
  }

  const profiles = [...new Set(results.map((r) => r.profile))];
  sheet.addRow({});
  sheet.addRow({ field: 'Profiles Tested', value: profiles.join(', ') });
  const personas = [...new Set(results.map((r) => r.personaName).filter(Boolean))] as string[];
  if (personas.length > 0) {
    sheet.addRow({ field: 'Personas Tested', value: personas.join(', ') });
  }
}

async function buildTestCasesSheet(
  workbook: ExcelJS.Workbook,
  results: TestCaseResult[],
  options: ReportOptions
): Promise<void> {
  const sheet = workbook.addWorksheet('Test Cases', {
    properties: { tabColor: { argb: '70AD47' } },
  });

  sheet.columns = [
    { header: 'TC ID', key: 'tcId', width: 12 },
    { header: 'Title', key: 'title', width: 45 },
    { header: 'Persona', key: 'personaName', width: 18 },
    { header: 'Profile', key: 'profile', width: 22 },
    { header: 'Role', key: 'expectedRole', width: 16 },
    { header: 'Permission Sets', key: 'permissionSets', width: 28 },
    { header: 'Steps', key: 'steps', width: 50 },
    { header: 'Expected', key: 'expected', width: 35 },
    { header: 'Actual', key: 'actual', width: 35 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Screenshot', key: 'screenshot', width: 20 },
    { header: 'RCA', key: 'rcaCategory', width: 14 },
    { header: 'Notes', key: 'notes', width: 30 },
    { header: 'Duration', key: 'duration', width: 12 },
  ];

  const headerFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4472C4' },
  };
  const headerFont: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: 'FFFFFF' },
    size: 11,
  };

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin' },
    };
  });

  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 14 },
  };

  for (const result of results) {
    const row = sheet.addRow({
      tcId: result.tcId,
      title: result.title,
      personaName: result.personaName || '',
      profile: result.profile,
      expectedRole: result.expectedRole || '',
      permissionSets: result.permissionSets || '',
      steps: result.steps,
      expected: result.expectedResult,
      actual: result.actualResult,
      status: result.status,
      screenshot: '',
      rcaCategory: result.rcaCategory || '',
      notes: result.notes || '',
      duration: result.duration ? `${(result.duration / 1000).toFixed(1)}s` : '',
    });

    const statusCell = row.getCell('status');
    if (result.status === 'PASS') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'C6EFCE' },
      };
      statusCell.font = { color: { argb: '006100' }, bold: true };
    } else if (result.status === 'FAIL') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC7CE' },
      };
      statusCell.font = { color: { argb: '9C0006' }, bold: true };
    } else {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEB9C' },
      };
      statusCell.font = { color: { argb: '9C6500' }, bold: true };
    }

    statusCell.alignment = { horizontal: 'center' };

    row.eachCell((cell) => {
      cell.alignment = { ...cell.alignment, vertical: 'top', wrapText: true };
    });

    if (result.screenshotPath && fs.existsSync(result.screenshotPath)) {
      try {
        if (options.embedScreenshots !== false) {
          const imageId = workbook.addImage({
            filename: result.screenshotPath,
            extension: 'png',
          });

          const rowNum = row.number;
          sheet.addImage(imageId, {
            tl: { col: 11, row: rowNum - 1 },
            ext: { width: 200, height: 120 },
          });

          row.height = 100;
        } else {
          row.getCell('screenshot').value = path.basename(result.screenshotPath);
        }
      } catch {
        row.getCell('screenshot').value = path.basename(result.screenshotPath);
      }
    }
  }
}

function walkPngFiles(dir: string, safeName: string, out: Set<string>): void {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPngFiles(fullPath, safeName, out);
    } else if (entry.name.includes(safeName) && entry.name.endsWith('.png')) {
      out.add(fullPath);
    }
  }
}

export function collectScreenshots(testName: string, subfolder?: string): string[] {
  const safeName = testName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const roots = subfolder ? [path.join(SCREENSHOTS_DIR, subfolder), SCREENSHOTS_DIR] : [SCREENSHOTS_DIR];
  const screenshots = new Set<string>();

  for (const root of roots) {
    walkPngFiles(root, safeName, screenshots);
  }

  return [...screenshots].sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

export function getLatestScreenshotPath(testName: string, subfolder?: string): string | undefined {
  return collectScreenshots(testName, subfolder)[0];
}

export function cleanupOldReports(olderThanDays: number): number {
  if (!fs.existsSync(REPORTS_DIR)) return 0;

  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  let deleted = 0;

  for (const file of fs.readdirSync(REPORTS_DIR)) {
    const filepath = path.join(REPORTS_DIR, file);
    const stat = fs.statSync(filepath);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(filepath);
      deleted++;
    }
  }

  return deleted;
}

export function cleanupOldScreenshots(olderThanDays: number): number {
  if (!fs.existsSync(SCREENSHOTS_DIR)) return 0;

  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  let deleted = 0;

  for (const file of fs.readdirSync(SCREENSHOTS_DIR)) {
    const filepath = path.join(SCREENSHOTS_DIR, file);
    const stat = fs.statSync(filepath);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(filepath);
      deleted++;
    }
  }

  return deleted;
}
