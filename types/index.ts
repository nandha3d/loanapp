import 'next-auth';

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: string;
    tenantId?: string;
    branchId?: string | null;        // for admin/agent: their fixed branch
    activeBranchId?: string | null;  // NEW: for superadmin active branch (from cookie)
    phone?: string;
    username?: string;
    appType?: string;                // kept for agent/admin rows
  }
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      tenantId: string;
      branchId: string | null;
      activeBranchId: string | null; // NEW
      phone: string;
      username: string;
      appType: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    }
  }
}
