import { spawnSync } from 'node:child_process';

const authCompatibility = process.argv.includes('--auth-compat');
const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== '--auth-compat');
const specs = authCompatibility ? [
  'e2e/loantrack-auth-compat.spec.ts',
] : [
  'e2e/loantrack-critical-flow.spec.ts',
  'e2e/loantrack-rbac-menu.spec.ts',
  'e2e/loantrack-reports-visibility.spec.ts',
];

const env = {
  ...process.env,
  ...(authCompatibility
    ? { LOANTRACK_E2E_AUTH_COMPAT: '1' }
    : { LOANTRACK_E2E_UI: '1' }),
};

const result = spawnSync(
  'npx',
  ['playwright', 'test', ...specs, ...forwardedArgs],
  {
    stdio: 'inherit',
    env,
    shell: true,
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
