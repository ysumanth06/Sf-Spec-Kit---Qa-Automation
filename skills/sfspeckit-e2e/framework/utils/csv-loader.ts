/**
 * csv-loader.ts — CSV Data Source Loader
 *
 * Parses CSV files for data-driven test parameterization.
 * Supports the JSON DSL "dataSource" field to iterate the same
 * test template against multiple data rows.
 *
 * Usage in JSON DSL:
 * {
 *   "dataSource": "data/accounts.csv",
 *   "iterateRows": true,
 *   "tests": [ ... ]
 * }
 *
 * Each row becomes a set of variables (e.g., {{Name}}, {{Industry}})
 * that are substituted into test steps.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CsvRow {
  [column: string]: string;
}

/**
 * Parse a CSV file into an array of objects keyed by column header.
 *
 * Supports:
 * - Quoted fields with commas inside ("value, with comma")
 * - Escaped quotes ("value ""with"" quotes")
 * - CRLF and LF line endings
 * - Empty fields
 */
export function parseCsv(filePath: string): CsvRow[] {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(__dirname, '..', filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `CSV data source not found: ${absolutePath}\n` +
      `Ensure the file exists relative to the framework directory or provide an absolute path.`,
    );
  }

  const content = fs.readFileSync(absolutePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = splitCsvLines(content);

  if (lines.length < 2) {
    throw new Error(`CSV file has no data rows: ${absolutePath}`);
  }

  const headers = parseCsvLine(lines[0]);
  if (headers.length === 0) {
    throw new Error(`CSV file has no column headers: ${absolutePath}`);
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // skip empty lines

    const values = parseCsvLine(line);
    const row: CsvRow = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (values[j] || '').trim();
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Split CSV content into lines, respecting quoted fields that span multiple lines.
 */
function splitCsvLines(content: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '"') {
      // Check for escaped quote ""
      if (inQuotes && i + 1 < content.length && content[i + 1] === '"') {
        current += '""';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
        current += char;
      }
    } else if (char === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Don't forget the last line
  if (current.trim()) {
    lines.push(current);
  }

  return lines;
}

/**
 * Parse a single CSV line into field values.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current); // last field
  return fields;
}

/**
 * Convert a CSV row into a variable map for the JSON runner.
 * Column headers become variable keys with {{}} delimiters.
 *
 * Example: { Name: "Acme" } → Map { "{{Name}}" => "Acme" }
 */
export function csvRowToVariables(row: CsvRow, rowIndex: number): Map<string, string> {
  const variables = new Map<string, string>();

  for (const [key, value] of Object.entries(row)) {
    variables.set(`{{${key}}}`, value);
  }

  // Also provide the row index as a variable
  variables.set('{{ROW_INDEX}}', String(rowIndex));
  variables.set('{{ROW_NUMBER}}', String(rowIndex + 1));

  return variables;
}

/**
 * Resolve a data source path relative to the test file or framework directory.
 */
export function resolveDataSourcePath(dataSource: string, testFilePath?: string): string {
  if (path.isAbsolute(dataSource)) {
    return dataSource;
  }

  // Try relative to the test file first
  if (testFilePath) {
    const testDir = path.dirname(testFilePath);
    const relative = path.resolve(testDir, dataSource);
    if (fs.existsSync(relative)) {
      return relative;
    }
  }

  // Fall back to relative to framework directory
  return path.resolve(__dirname, '..', dataSource);
}
