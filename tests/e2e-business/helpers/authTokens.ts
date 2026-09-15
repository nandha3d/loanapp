import { routeRequest, expectOk, routes, type Envelope } from './apiClient';
import { APP_TYPE } from './testDb';

type LoginData = {
  token: string;
  refreshToken: string | null;
  user: {
    id: string;
    username: string;
    role: string;
    tenantSlug: string;
    branchId: string | null;
    status: string;
  };
};

export async function loginMobile(input: {
  username: string;
  password: string;
  tenantSlug: string;
}) {
  const response = await routeRequest<Envelope<LoginData>>({
    importPath: routes.authLogin,
    method: 'POST',
    path: '/api/v1/auth/login',
    tenantSlug: input.tenantSlug,
    appType: APP_TYPE,
    body: { username: input.username, password: input.password },
  });
  return expectOk<LoginData>(response, `login failed for ${input.username}`);
}

export async function issueMobileTokenForSetup(user: {
  id: string;
  tenantId: string;
  branchId: string | null;
  role: string;
  appType?: string | null;
}) {
  const { issueMobileToken } = await import('../../../lib/api/v1-auth');
  return issueMobileToken({
    userId: user.id,
    tenantId: user.tenantId,
    branchId: user.branchId,
    role: user.role,
    appType: user.appType || APP_TYPE,
  });
}

export async function borrowerLoginAndVerify(input: { phone: string; tenantSlug: string }) {
  const login = await routeRequest<Envelope<{ challengeToken: string; testOtp: string }>>({
    importPath: routes.borrowerLogin,
    method: 'POST',
    path: '/api/v1/borrower/auth/login',
    tenantSlug: input.tenantSlug,
    body: { phone: input.phone },
  });
  const challenge = expectOk(login, 'borrower OTP login failed');

  const verify = await routeRequest<Envelope<{ token: string; customerId: string; loanId: string | null }>>({
    importPath: routes.borrowerVerify,
    method: 'POST',
    path: '/api/v1/borrower/auth/verify',
    tenantSlug: input.tenantSlug,
    body: {
      phone: input.phone,
      otp: challenge.testOtp,
      challengeToken: challenge.challengeToken,
    },
  });
  return expectOk(verify, 'borrower OTP verification failed');
}
