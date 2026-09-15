import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  ZOLOFUND_E2E_UI: '1',
};

const result = spawnSync(
  'npx',
  [
    'playwright',
    'test',
    'e2e/zolofund-agent-portal.spec.ts',
    '--project=zolofund-critical-chromium',
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
