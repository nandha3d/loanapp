'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppType } from '@/lib/appConfig';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { getSuperadminBranches, getActiveBranchId } from '@/lib/branch';
import { isModuleKey, modulePath, normalizeModuleList } from '@/types/modules';

export async function selectApp(appType: AppType) {
  if (!isModuleKey(appType)) {
    redirect('/portal?moduleAccess=invalid');
  }

  const cookieStore = await cookies();
  const session = await auth();
  const user = session?.user as any;

  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent('/portal')}`);
  }
  
  if (user && user.role === 'superadmin') {
    const tenantId = await getDefaultTenantId();
    const branches = await getSuperadminBranches(tenantId, user.id);
    const activeBranchId = await getActiveBranchId();
    
    // Check if current active branch supports this app
    const activeBranch = branches.find(b => b.id === activeBranchId);
    const activeModules = activeBranch ? normalizeModuleList(activeBranch.enabledModules) : [];
    
    if (!activeModules.includes(appType)) {
      // Find a branch that DOES support it
      const compatibleBranch = branches.find(b => normalizeModuleList(b.enabledModules).includes(appType));
      if (compatibleBranch) {
        cookieStore.set('active_branch_id', compatibleBranch.id, {
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        });
      } else {
        redirect(`/portal?moduleAccess=denied&module=${encodeURIComponent(appType)}`);
      }
    }
  } else if (user.role === 'admin' || user.role === 'agent') {
    const { getActiveModules } = await import('@/lib/branch');
    const activeModules = await getActiveModules();
    if (!activeModules.includes(appType)) {
      redirect(`/portal?moduleAccess=denied&module=${encodeURIComponent(appType)}`);
    }
  }

  cookieStore.set('active_app_type', appType, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  
  redirect(modulePath(appType, user.role === 'agent' ? '/agent-dashboard' : '/dashboard'));
}
