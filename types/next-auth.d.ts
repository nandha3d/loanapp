import 'next-auth';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      tenantId: string;
      branchId: string | null;
      activeBranchId: string | null;
      phone: string;
      username: string;
      appType: string;
    } & DefaultSession['user'];
  }

  interface User {
    role?: string;
    tenantId?: string;
    branchId?: string | null;
    activeBranchId?: string | null;
    phone?: string;
    username?: string;
    appType?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: string;
    tenantId?: string;
    branchId?: string | null;
    activeBranchId?: string | null;
    phone?: string;
    username?: string;
    appType?: string;
  }
}
