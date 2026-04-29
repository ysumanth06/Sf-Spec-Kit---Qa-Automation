/**
 * doctor.ts — Environment Health Check
 *
 * Validates that the QA environment is correctly configured before
 * running tests. Checks for:
 *   - Node.js and Chrome availability
 *   - Playwright installation
 *   - .env configuration
 *   - personas.json validity
 *   - Salesforce org connectivity
 *   - domains.json validity
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const FRAMEWORK_DIR = path.resolve(__dirname, '..');
const CHECKS: Array<{ name: string; check: () => string }> = [];

function addCheck(name: string, check: () => string): void {
  CHECKS.push({ name, check });
}

// ── Node.js ──────────────────────────────────────────────
addCheck('Node.js v18+', () => {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  if (major < 18) return `❌ Node ${version} (need v18+)`;
  return `✅ ${version}`;
});

// ── Chrome ───────────────────────────────────────────────
addCheck('Google Chrome', () => {
  try {
    const result = execSync(
      process.platform === 'darwin'
        ? '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --version 2>/dev/null'
        : 'google-chrome --version 2>/dev/null || chromium --version 2>/dev/null',
      { encoding: 'utf8', timeout: 5000 },
    ).trim();
    return `✅ ${result}`;
  } catch {
    return '❌ Chrome not found (install Google Chrome)';
  }
});

// ── Playwright ───────────────────────────────────────────
addCheck('Playwright', () => {
  const pkgPath = path.join(FRAMEWORK_DIR, 'node_modules', '@playwright', 'test', 'package.json');
  if (!fs.existsSync(pkgPath)) return '❌ Not installed (run npm install)';
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return `✅ v${pkg.version}`;
});

// ── .env File ────────────────────────────────────────────
addCheck('.env configuration', () => {
  const envPath = path.join(FRAMEWORK_DIR, '.env');
  if (!fs.existsSync(envPath)) return '❌ .env not found (copy .env.example → .env)';

  const content = fs.readFileSync(envPath, 'utf8');
  const issues: string[] = [];

  const hasAlias = content.includes('E2E_ADMIN_ALIAS') && !content.match(/E2E_ADMIN_ALIAS\s*=\s*$/m);
  const hasJwtClient = content.includes('E2E_JWT_CLIENT_ID') && !content.match(/E2E_JWT_CLIENT_ID\s*=\s*$/m);
  const hasJwtInstance = content.includes('E2E_JWT_INSTANCE_URL') && !content.match(/E2E_JWT_INSTANCE_URL\s*=\s*$/m);

  if (!hasAlias && !hasJwtClient) issues.push('Missing E2E_ADMIN_ALIAS or E2E_JWT_CLIENT_ID');
  if (!hasAlias && !hasJwtInstance) issues.push('Missing E2E_JWT_INSTANCE_URL');

  if (issues.length > 0) return `⚠️ ${issues.join('; ')}`;
  return '✅ Configured';
});

// ── personas.json ────────────────────────────────────────
addCheck('personas.json', () => {
  const personasPath = path.join(FRAMEWORK_DIR, 'personas.json');
  if (!fs.existsSync(personasPath)) {
    // Check E2E_JWT_USERS fallback
    if (process.env.E2E_JWT_USERS) return '✅ Using E2E_JWT_USERS from .env';
    return '❌ Not found (copy personas.example.json → personas.json)';
  }

  try {
    const data = JSON.parse(fs.readFileSync(personasPath, 'utf8'));
    if (!data.personas || !Array.isArray(data.personas)) return '❌ Invalid format (missing "personas" array)';
    if (data.personas.length === 0) return '⚠️ No personas defined';

    const names = data.personas.map((p: any) => p.name).join(', ');
    return `✅ ${data.personas.length} persona(s): ${names}`;
  } catch (err) {
    return `❌ Parse error: ${err}`;
  }
});

// ── domains.json ─────────────────────────────────────────
addCheck('domains.json', () => {
  const domainsPath = path.join(FRAMEWORK_DIR, 'domains.json');
  if (!fs.existsSync(domainsPath)) return '⚠️ Not found (optional — only needed for /e2e-baseline domain scoping)';

  try {
    const data = JSON.parse(fs.readFileSync(domainsPath, 'utf8'));
    const domains = Object.keys(data.domains || {});
    return `✅ ${domains.length} domain(s): ${domains.join(', ')}`;
  } catch (err) {
    return `❌ Parse error: ${err}`;
  }
});

// ── sf CLI ───────────────────────────────────────────────
addCheck('Salesforce CLI (sf)', () => {
  try {
    const version = execSync('sf --version 2>/dev/null', { encoding: 'utf8', timeout: 10000 }).trim();
    return `✅ ${version.split('\n')[0]}`;
  } catch {
    return '⚠️ sf CLI not found (needed for verifyDatabase steps)';
  }
});

// ── Org Connectivity ─────────────────────────────────────
addCheck('Salesforce Org Connection', () => {
  const alias = process.env.E2E_ADMIN_ALIAS;
  if (!alias) return '⏭️ Skipped (no E2E_ADMIN_ALIAS set)';

  try {
    const result = execSync(`sf org display -o ${alias} --json 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 15000,
    });
    const data = JSON.parse(result);
    if (data?.result?.connectedStatus === 'Connected' || data?.result?.accessToken) {
      return `✅ Connected to ${data.result.instanceUrl || alias}`;
    }
    return `⚠️ Org exists but may not be connected (status: ${data?.result?.connectedStatus || 'unknown'})`;
  } catch {
    return `❌ Cannot reach org "${alias}" (run: sf org login web -a ${alias})`;
  }
});

// ── Run All Checks ───────────────────────────────────────

function run(): void {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   SFSpeckit-E2E Environment Health Check     ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  let passed = 0;
  let warned = 0;
  let failed = 0;

  for (const { name, check } of CHECKS) {
    const result = check();
    console.log(`  ${result.padEnd(60)} (${name})`);

    if (result.startsWith('✅')) passed++;
    else if (result.startsWith('⚠️')) warned++;
    else if (result.startsWith('❌')) failed++;
  }

  console.log(`\n  ──────────────────────────────────────────────`);
  console.log(`  ✅ ${passed} passed  ⚠️ ${warned} warnings  ❌ ${failed} failed\n`);

  if (failed > 0) {
    console.log('  ❌ Fix the failed checks before running tests.');
    process.exit(1);
  } else if (warned > 0) {
    console.log('  ⚠️ Some warnings detected. Tests may still run but with reduced functionality.');
  } else {
    console.log('  🎉 All checks passed! You are ready to test.');
  }
}

// Load .env before running
require('dotenv').config({ path: path.join(FRAMEWORK_DIR, '.env') });
run();
