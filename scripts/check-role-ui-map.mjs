#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const MAP_PATH = path.join(ROOT, 'docs/mobile-parity/role-ui-map.json');
const ROUTER_PATH = path.join(ROOT, 'mobile/lib/core/router/app_router.dart');
const REPORT_PATH = path.join(ROOT, 'tmp/role-ui-map-report.md');
const REQUIRED_NODE = [22, 22, 0];
const REQUIRED_ROLES = ['developer', 'superadmin', 'admin', 'agent'];

function markFailure(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function versionTuple(raw) {
  return raw.replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10));
}

function compareVersion(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function stripComments(source) {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') {
        out += ' ';
        i += 1;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      out += '  ';
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function findMatching(source, openIndex, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    const prev = source[i - 1];
    if (quote) {
      if (ch === quote && prev !== '\\') quote = null;
      continue;
    }
    if (ch === '\'' || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === openChar) depth += 1;
    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function joinRoute(parent, child) {
  if (child.startsWith('/')) return child;
  const cleanParent = parent === '/' ? '' : parent.replace(/\/$/, '');
  return `${cleanParent}/${child}`.replace(/\/+/g, '/');
}

function parseGoRoutes(source, parent = '') {
  const routes = [];
  let i = 0;
  while (i < source.length) {
    const idx = source.indexOf('GoRoute', i);
    if (idx === -1) break;
    const open = source.indexOf('(', idx);
    if (open === -1) break;
    const close = findMatching(source, open, '(', ')');
    if (close === -1) break;

    const block = source.slice(open + 1, close);
    const pathMatch = block.match(/path:\s*'([^']+)'/);
    if (pathMatch) {
      const full = joinRoute(parent, pathMatch[1]);
      routes.push(full);
      routes.push(...parseGoRoutes(block, full));
    }
    i = close + 1;
  }
  return routes;
}

function existingMobileRoutes() {
  const router = fs.readFileSync(ROUTER_PATH, 'utf8');
  return new Set(parseGoRoutes(stripComments(router)));
}

function normalizeMobilePattern(route) {
  return route.replace(/\[[^\]]+\]/g, ':id');
}

function validateMap(map, mobileRoutes) {
  const errors = [];
  const warnings = [];

  for (const role of REQUIRED_ROLES) {
    const data = map.roles?.[role];
    if (!data) {
      errors.push(`Missing role: ${role}`);
      continue;
    }

    for (const routeInfo of data.web?.primaryRoutes ?? []) {
      if (!routeInfo.source) {
        errors.push(`${role}: web route ${routeInfo.route} is missing source`);
      } else if (!fs.existsSync(path.join(ROOT, routeInfo.source))) {
        errors.push(`${role}: source not found for ${routeInfo.route}: ${routeInfo.source}`);
      }
    }

    for (const gap of data.gaps ?? []) {
      if (!gap.status || !['missing', 'partial'].includes(gap.status)) {
        errors.push(`${role}: invalid gap status for ${gap.webRoute}`);
      }
      if (!gap.priority || !/^P[0-3]$/.test(gap.priority)) {
        errors.push(`${role}: invalid priority for ${gap.webRoute}`);
      }
      if (gap.source && !fs.existsSync(path.join(ROOT, gap.source))) {
        errors.push(`${role}: gap source not found for ${gap.webRoute}: ${gap.source}`);
      }
      if (gap.mobileRoute && !mobileRoutes.has(normalizeMobilePattern(gap.mobileRoute))) {
        warnings.push(`${role}: mapped mobile route not found in app_router.dart: ${gap.mobileRoute}`);
      }
    }

    for (const route of data.mobile?.primaryRoutes ?? []) {
      if (!mobileRoutes.has(normalizeMobilePattern(route))) {
        warnings.push(`${role}: primary mobile route not found in app_router.dart: ${route}`);
      }
    }

    for (const item of data.mobileOnly ?? []) {
      if (!mobileRoutes.has(normalizeMobilePattern(item.route))) {
        warnings.push(`${role}: mobile-only route not found in app_router.dart: ${item.route}`);
      }
    }
  }

  return { errors, warnings };
}

function summarize(map, mobileRoutes, validation) {
  const lines = [];
  lines.push('# Role UI Map Check');
  lines.push('');
  lines.push(`Node: ${process.version}`);
  lines.push(`Map: ${path.relative(ROOT, MAP_PATH)}`);
  lines.push(`Mobile routes discovered: ${mobileRoutes.size}`);
  lines.push('');
  lines.push('| Role | Web routes | Mobile routes | Missing | Partial | Mobile-only |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const role of REQUIRED_ROLES) {
    const data = map.roles[role];
    const missing = data.gaps.filter((gap) => gap.status === 'missing').length;
    const partial = data.gaps.filter((gap) => gap.status === 'partial').length;
    lines.push(`| ${role} | ${data.web.primaryRoutes.length} | ${data.mobile.primaryRoutes.length} | ${missing} | ${partial} | ${data.mobileOnly.length} |`);
  }
  lines.push('');

  for (const role of REQUIRED_ROLES) {
    const data = map.roles[role];
    lines.push(`## ${role}`);
    for (const gap of data.gaps) {
      const mobile = gap.mobileRoute ? ` -> ${gap.mobileRoute}` : '';
      lines.push(`- [${gap.priority}] ${gap.status}: ${gap.label} (${gap.webRoute}${mobile})`);
    }
    if (data.mobileOnly.length) {
      lines.push(`- mobile-only: ${data.mobileOnly.map((item) => item.route).join(', ')}`);
    }
    lines.push('');
  }

  if (validation.warnings.length) {
    lines.push('## Warnings');
    for (const warning of validation.warnings) lines.push(`- ${warning}`);
    lines.push('');
  }

  if (validation.errors.length) {
    lines.push('## Errors');
    for (const error of validation.errors) lines.push(`- ${error}`);
    lines.push('');
  }

  return lines.join('\n');
}

const nodeOk = compareVersion(versionTuple(process.version), REQUIRED_NODE) >= 0;
if (!nodeOk) {
  markFailure(`Node ${process.version} is below required v${REQUIRED_NODE.join('.')}`);
}

if (!fs.existsSync(MAP_PATH)) markFailure(`Missing ${MAP_PATH}`);
if (!fs.existsSync(ROUTER_PATH)) markFailure(`Missing ${ROUTER_PATH}`);
if (process.exitCode) process.exit(process.exitCode);

const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
const mobileRoutes = existingMobileRoutes();
const validation = validateMap(map, mobileRoutes);
const report = summarize(map, mobileRoutes, validation);

console.log(report);

if (process.argv.includes('--write-report')) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${report}\n`);
  console.log(`Wrote ${path.relative(ROOT, REPORT_PATH)}`);
}

for (const warning of validation.warnings) console.warn(`WARNING: ${warning}`);
for (const error of validation.errors) markFailure(error);

if (!process.exitCode) {
  console.log('Role UI map check passed.');
}
