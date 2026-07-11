import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  LOANTRACK_E2E_UI: '1',
};

const result = spawnSync(
  'npx',
  [
    'playwright',
    'test',
    'e2e/loantrack-agent-portal.spec.ts',
    '--project=loantrack-critical-chromium',
    ...process.argv.slice(2),
  ],
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
