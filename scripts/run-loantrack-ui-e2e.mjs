import { spawnSync } from 'node:child_process';

const specs = [
  'e2e/loantrack-critical-flow.spec.ts',
  'e2e/loantrack-rbac-menu.spec.ts',
  'e2e/loantrack-reports-visibility.spec.ts',
];

const env = {
  ...process.env,
  LOANTRACK_E2E_UI: '1',
};

const result = spawnSync(
  'npx',
  ['playwright', 'test', ...specs, ...process.argv.slice(2)],
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
