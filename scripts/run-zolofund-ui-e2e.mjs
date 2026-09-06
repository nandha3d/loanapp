import { spawnSync } from 'node:child_process';

const authCompatibility = process.argv.includes('--auth-compat');
const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== '--auth-compat');
const specs = authCompatibility ? [
  'e2e/zolofund-auth-compat.spec.ts',
] : [
  'e2e/zolofund-critical-flow.spec.ts',
  'e2e/zolofund-rbac-menu.spec.ts',
  'e2e/zolofund-reports-visibility.spec.ts',
];

const env = {
  ...process.env,
  ...(authCompatibility
    ? { ZOLOFUND_E2E_AUTH_COMPAT: '1' }
    : { ZOLOFUND_E2E_UI: '1' }),
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
