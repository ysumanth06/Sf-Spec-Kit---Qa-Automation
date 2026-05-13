import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import jsforce, { type Connection } from 'jsforce';
import type { Page, Browser, BrowserContext } from '@playwright/test';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export interface JwtConfig {
  clientId: string;
  keyFile: string;
  instanceUrl: string;
}

/** Expected org identity for doctor/preflight; optional role/PS for drift checks. */
export interface PersonaExpected {
  profile: string;
  role: string;
  permissionSets: string[];
}

/**
 * Full test identity: persona name (Playwright project name), credentials, and expected profile/role/PS.
 * Aligns with sf-e2e-testing extended JWT format (role + permission sets) when using E2E_JWT_USERS only.
 */
export interface Persona {
  name: string;
  username: string;
  alias: string;
  expected: PersonaExpected;
  /** Filled at scan/runtime (package-scanner / doctor) — not configured in JSON */
  discoveredLicenses?: string[];
  /** Experience Cloud / site base URL for community tests (optional) */
  communityUrl?: string;
}

/**
 * @deprecated Use {@link Persona}. Retained for callers that expect profileName/sfUsername shape.
 */
export interface ProfileUser {
  profileName: string;
  alias: string;
  sfUsername: string;
}

interface TokenResponse {
  access_token: string;
  instance_url: string;
  token_type: string;
  id: string;
}

interface SfOrgDisplayResult {
  result?: {
    accessToken?: string;
    instanceUrl?: string;
  };
}

const PERSONAS_JSON = path.resolve(__dirname, '..', 'personas.json');

// ═══════════════════════════════════════════════════════════
// Connection cache — avoid calling sf CLI / JWT on every test
// ═══════════════════════════════════════════════════════════

const connectionCache = new Map<string, Connection>();

let personasCache: Persona[] | null = null;

export function getJwtConfig(): JwtConfig {
  return {
    clientId: process.env.E2E_JWT_CLIENT_ID || '',
    keyFile: path.resolve(__dirname, '..', process.env.E2E_JWT_KEY_FILE || 'certs/server.key'),
    instanceUrl: process.env.E2E_JWT_INSTANCE_URL || '',
  };
}

function readPersonasFile(): Persona[] | null {
  if (!fs.existsSync(PERSONAS_JSON)) return null;
  try {
    const raw = fs.readFileSync(PERSONAS_JSON, 'utf8');
    const data = JSON.parse(raw) as { personas?: Persona[] };
    if (!data.personas || !Array.isArray(data.personas)) return null;
    return data.personas.map((p) => ({
      ...p,
      communityUrl: p.communityUrl,
      expected: {
        profile: p.expected?.profile ?? '',
        role: p.expected?.role ?? '',
        permissionSets: p.expected?.permissionSets ?? [],
      },
    }));
  } catch {
    return null;
  }
}

/**
 * Parses one E2E_JWT_USERS entry.
 * - 3 parts: `Label:alias:username` (Label = Playwright project name; legacy profile-only)
 * - 4+ parts: `Label:alias:username:role` or `Label:alias:username:role:PS1;PS2` (matches sf-e2e-testing extended format)
 */
function parseEnvPersonaEntry(entry: string): Persona {
  const parts = entry.split(':').map((s) => s.trim());
  if (parts.length < 3) {
    throw new Error(`Invalid E2E_JWT_USERS entry (need at least Label:alias:username): ${entry}`);
  }
  const label = parts[0];
  const alias = parts[1];
  const username = parts[2];
  let role = '';
  let permissionSets: string[] = [];
  if (parts.length === 4) {
    role = parts[3];
  } else if (parts.length >= 5) {
    role = parts[3];
    permissionSets = parts[4]
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return {
    name: label,
    username,
    alias,
    expected: {
      profile: label,
      role,
      permissionSets,
    },
  };
}

function personasFromEnv(): Persona[] {
  const raw = process.env.E2E_JWT_USERS || '';
  if (!raw) return [];
  return raw.split(',').map((entry) => parseEnvPersonaEntry(entry));
}

/**
 * Load personas from `personas.json` if present; otherwise from `E2E_JWT_USERS`.
 */
export function loadPersonas(): Persona[] {
  if (personasCache) return personasCache;
  const fromFile = readPersonasFile();
  personasCache = fromFile && fromFile.length > 0 ? fromFile : personasFromEnv();
  return personasCache;
}

/** Clear cache (e.g. tests). */
export function clearPersonasCache(): void {
  personasCache = null;
}

export function personaToProfileUser(p: Persona): ProfileUser {
  return { profileName: p.name, alias: p.alias, sfUsername: p.username };
}

/**
 * Parses E2E_JWT_USERS env var into legacy ProfileUser rows (persona name = first column).
 */
export function getProfileUsers(): ProfileUser[] {
  return loadPersonas().map(personaToProfileUser);
}

/**
 * Resolve a persona by Playwright project name (persona name) or expected Salesforce profile (case-insensitive).
 */
export function getPersona(nameOrProfile: string): Persona {
  const personas = loadPersonas();
  const needle = nameOrProfile.trim().toLowerCase();
  const user =
    personas.find((p) => p.name.toLowerCase() === needle) ||
    personas.find((p) => p.expected.profile.toLowerCase() === needle);
  if (!user) {
    throw new Error(
      `No persona configured for "${nameOrProfile}". ` +
        `Available: ${personas.map((p) => p.name).join(', ')}. ` +
        `Check personas.json or E2E_JWT_USERS in .env`
    );
  }
  return user;
}

/**
 * @deprecated Prefer {@link getPersona}. Same lookup rules as getPersona.
 */
export function getProfileUser(profileName: string): ProfileUser {
  return personaToProfileUser(getPersona(profileName));
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ═══════════════════════════════════════════════════════════
// JWT Bearer Flow — works with External Client Apps
// ═══════════════════════════════════════════════════════════

async function tryJwtWithAudience(
  sfUsername: string,
  audience: string,
  tokenUrl: string,
  config: JwtConfig,
  privateKey: string,
): Promise<TokenResponse> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256' };
  const claims = {
    iss: config.clientId,
    sub: sfUsername,
    aud: audience,
    exp: now + 300,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaims = base64url(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = base64url(sign.sign(privateKey));

  const assertion = `${signingInput}.${signature}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JWT auth failed (aud=${audience}): ${response.status} ${errorText}`);
  }

  return (await response.json()) as TokenResponse;
}

/**
 * Obtain an access token via JWT Bearer flow.
 * Tries instance URL as audience first (External Client Apps),
 * then falls back to the generic login URL (traditional Connected Apps).
 */
export async function getJwtAccessToken(sfUsername: string): Promise<TokenResponse> {
  const config = getJwtConfig();
  const privateKey = fs.readFileSync(config.keyFile, 'utf8');

  const loginUrl = config.instanceUrl.includes('sandbox')
    ? 'https://test.salesforce.com'
    : 'https://login.salesforce.com';

  try {
    return await tryJwtWithAudience(
      sfUsername,
      config.instanceUrl,
      `${loginUrl}/services/oauth2/token`,
      config,
      privateKey,
    );
  } catch {
    // Fall back to generic login URL as audience
  }

  return tryJwtWithAudience(
    sfUsername,
    loginUrl,
    `${loginUrl}/services/oauth2/token`,
    config,
    privateKey,
  );
}

/**
 * Get a jsforce Connection via JWT for a specific Salesforce username.
 */
export async function getJwtConnection(sfUsername: string): Promise<Connection> {
  const cached = connectionCache.get(`jwt:${sfUsername}`);
  if (cached) return cached;

  const token = await getJwtAccessToken(sfUsername);
  const conn = new jsforce.Connection({
    instanceUrl: token.instance_url,
    accessToken: token.access_token,
  });

  connectionCache.set(`jwt:${sfUsername}`, conn);
  return conn;
}

// ═══════════════════════════════════════════════════════════
// sf CLI Connection — uses existing org authentication
// ═══════════════════════════════════════════════════════════

function getSfOrgDisplay(alias: string): SfOrgDisplayResult | null {
  try {
    const { execSync } = require('child_process');
    const authJson = execSync(`sf org display -o ${alias} --json`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(authJson) as SfOrgDisplayResult;
  } catch {
    // sf CLI not available or alias not found
    return null;
  }
}

export function getSfCliInstanceUrl(alias: string): string | null {
  const orgInfo = getSfOrgDisplay(alias);
  const instanceUrl = orgInfo?.result?.instanceUrl?.trim();
  return instanceUrl || null;
}

export function resolveSalesforceBaseUrl(): string {
  const jwtInstanceUrl = process.env.E2E_JWT_INSTANCE_URL?.trim();
  if (jwtInstanceUrl) {
    return jwtInstanceUrl.replace(/\/$/, '');
  }

  const adminAlias = process.env.E2E_ADMIN_ALIAS?.trim();
  if (adminAlias) {
    const cliInstanceUrl = getSfCliInstanceUrl(adminAlias);
    if (cliInstanceUrl) {
      return cliInstanceUrl.replace(/\/$/, '');
    }
  }

  return '';
}

function getSfCliConnection(alias: string): Connection | null {
  const cached = connectionCache.get(`cli:${alias}`);
  if (cached) return cached;

  const orgInfo = getSfOrgDisplay(alias);
  if (orgInfo?.result?.accessToken && orgInfo?.result?.instanceUrl) {
    const conn = new jsforce.Connection({
      instanceUrl: orgInfo.result.instanceUrl,
      accessToken: orgInfo.result.accessToken,
    });
    connectionCache.set(`cli:${alias}`, conn);
    console.log(`✅ Connected via sf CLI (${alias})`);
    return conn;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════
// Unified Connection — sf CLI alias -> JWT -> error
// ═══════════════════════════════════════════════════════════

/**
 * Get a connection for a specific persona (or legacy ProfileUser).
 */
export async function getConnection(personaOrLegacy: Persona | ProfileUser): Promise<Connection> {
  const persona =
    'expected' in personaOrLegacy
      ? personaOrLegacy
      : {
          name: personaOrLegacy.profileName,
          username: personaOrLegacy.sfUsername,
          alias: personaOrLegacy.alias,
          expected: {
            profile: personaOrLegacy.profileName,
            role: '',
            permissionSets: [],
          },
        };

  const cliConn = getSfCliConnection(persona.alias);
  if (cliConn) return cliConn;

  const adminAlias = process.env.E2E_ADMIN_ALIAS;
  if (adminAlias && adminAlias !== persona.alias) {
    const adminConn = getSfCliConnection(adminAlias);
    if (adminConn) return adminConn;
  }

  return getJwtConnection(persona.username);
}

/**
 * Get admin connection (convenience wrapper).
 */
export async function getAdminConnection(): Promise<Connection> {
  const adminAlias = process.env.E2E_ADMIN_ALIAS;
  if (adminAlias) {
    const cliConn = getSfCliConnection(adminAlias);
    if (cliConn) return cliConn;
  }

  const personas = loadPersonas();
  const adminUser =
    personas.find((p) => p.name.toLowerCase().includes('admin')) ||
    personas.find((p) => p.expected.profile.toLowerCase().includes('administrator'));
  if (!adminUser) {
    throw new Error(
      'No admin persona found. Add a persona named like "Admin" or with profile System Administrator in personas.json / E2E_JWT_USERS.',
    );
  }
  return getJwtConnection(adminUser.username);
}

export async function getFrontdoorUrl(conn: Connection, targetUrl?: string): Promise<string> {
  const base = `${conn.instanceUrl}/secur/frontdoor.jsp?sid=${conn.accessToken}`;
  if (targetUrl) {
    return `${base}&retURL=${encodeURIComponent(targetUrl)}`;
  }
  return base;
}

// ═══════════════════════════════════════════════════════════
// Browser Authentication — cookie injection bypasses MFA
// ═══════════════════════════════════════════════════════════

/** Clear cached JWT connection so the next call fetches a fresh access token (e.g. after session expiry). */
export function clearJwtConnectionForUser(username: string): void {
  connectionCache.delete(`jwt:${username}`);
}

/**
 * Detect Salesforce login / session-expired screens after navigation.
 */
export async function isSessionExpired(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes('secur/login') || url.includes('/login') || url.includes('logout')) {
    return true;
  }
  const oneApp = page.locator('one-app-nav-bar');
  const hasShell = await oneApp.isVisible().catch(() => false);
  if (hasShell) return false;

  const pwInput = page.locator('input#password, input[name="pw"], input[type="password"]').first();
  const hasPw = await pwInput.isVisible().catch(() => false);
  if (hasPw) {
    const userInput = page.locator('input#username, input[name="username"]').first();
    if (await userInput.isVisible().catch(() => false)) return true;
  }

  const body = (await page.textContent('body').catch(() => '')) || '';
  if (/session\s+(has\s+)?expired|logged\s+out|invalid\s+session|identity verification/i.test(body)) {
    return true;
  }
  return false;
}

export async function injectSessionCookies(
  context: BrowserContext,
  page: Page,
  conn: Connection,
): Promise<void> {
  const instanceHost = new URL(conn.instanceUrl).hostname;

  await context.addCookies([
    {
      name: 'sid',
      value: conn.accessToken!,
      domain: instanceHost,
      path: '/',
      secure: true,
      httpOnly: true,
    },
  ]);

  await page.goto(`${conn.instanceUrl}/lightning/page/home`, {
    waitUntil: 'domcontentloaded',
  });

  try {
    await page.waitForSelector(
      'one-app-nav-bar, force-highlights-details-item, records-record-layout-section',
      { state: 'visible', timeout: 30_000 },
    );
  } catch {
    // Lightning components may not be present on the home page
  }
}

/** Re-inject session cookies after clearing JWT cache (session timeout recovery). */
export async function reauthenticatePage(page: Page, persona: Persona): Promise<void> {
  clearJwtConnectionForUser(persona.username);
  const conn = await getConnection(persona);
  await injectSessionCookies(page.context(), page, conn);
}

export async function authenticatePage(page: Page, personaNameOrProfile: string): Promise<Page> {
  const user = getPersona(personaNameOrProfile);
  const conn = await getConnection(user);

  const context = page.context();
  await injectSessionCookies(context, page, conn);
  return page;
}

/**
 * Password login for Experience Cloud / Site (when JWT is not used).
 */
export async function authenticateCommunityUser(
  page: Page,
  communityBaseUrl: string,
  username: string,
  password: string,
): Promise<void> {
  const loginUrl = communityBaseUrl.replace(/\/$/, '') + (communityBaseUrl.includes('/s/') ? '' : '/s/login');
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('input#username, input[name="username"]').first().fill(username);
  await page.locator('input#password, input[name="pw"]').first().fill(password);
  await page.locator('input[type="submit"], button[type="submit"]').first().click();
}

export async function authenticateNewContext(
  browser: Browser,
  personaNameOrProfile: string,
): Promise<{ context: BrowserContext; page: Page; conn: Connection }> {
  const user = getPersona(personaNameOrProfile);
  const conn = await getConnection(user);

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    baseURL: conn.instanceUrl,
  });
  const page = await context.newPage();

  await injectSessionCookies(context, page, conn);
  return { context, page, conn };
}
