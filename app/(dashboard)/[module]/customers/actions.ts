'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import { encryptAadharNumber } from '@/lib/pii';
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES, validateFileBytes } from '@/lib/fileUpload';
import { getActiveBranchId } from '@/lib/branch';
import { modulePath } from '@/types/modules';

const UPLOAD_DIR = path.join(process.cwd(), 'private', 'uploads');

async function saveUploadedFile(file: File, tenantId: string, subfolder: string): Promise<string> {
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    throw new Error(`File type not allowed: ${file.type}. Only JPEG, PNG, WebP, and PDF are accepted.`);
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error('File exceeds the 5 MB limit.');
  }
  const dir = path.join(UPLOAD_DIR, tenantId, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, '').toLowerCase() || '';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(dir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateFileBytes(buffer, file.type)) {
    throw new Error('Invalid file signature. File may be corrupted or spoofed.');
  }
  fs.writeFileSync(filePath, buffer);
  return `/api/files/${tenantId}/${subfolder}/${safeName}`;
}

export async function saveCustomer(formData: FormData) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'agent';
  const userId = session?.user?.id;
  const activeBranchId = await getActiveBranchId();
  const editId = formData.get('id') as string | null;
  
  const name = formData.get('name') as string;
  const phone = formData.get('phone') as string;
  const address = formData.get('address') as string;
  const aadharNumberField = formData.get('aadharNumber') as string | null;
  const encryptedAadharNumber = aadharNumberField !== null
    ? encryptAadharNumber(aadharNumberField)
    : undefined;
  const routeId = formData.get('routeId') as string;
  const agentId = formData.get('agentId') as string;
  const email = (formData.get('email') as string) || null;
  const pan = (formData.get('pan') as string) || null;
  const companyName = (formData.get('companyName') as string) || null;
  const companyType = (formData.get('companyType') as string) || null;
  const occupation = (formData.get('occupation') as string) || null;
  const monthlyIncomeRaw = formData.get('monthlyIncome') as string | null;
  const monthlyIncome = monthlyIncomeRaw ? parseFloat(monthlyIncomeRaw) : null;
  const gstNumber = (formData.get('gstNumber') as string) || null;
  // Extended company / business profile
  const businessType = (formData.get('businessType') as string) || null;
  const companyPan = (formData.get('companyPan') as string) || null;
  const companyRegNo = (formData.get('companyRegNo') as string) || null;
  const companyAddress = (formData.get('companyAddress') as string) || null;
  const companyPhone = (formData.get('companyPhone') as string) || null;
  const companyEmail = (formData.get('companyEmail') as string) || null;
  const designation = (formData.get('designation') as string) || null;

  const isPopup = formData.get('isPopup') === 'true';

  // Validate routeId belongs to this tenant + appType
  if (routeId) {
    const route = await prisma.route.findFirst({ where: { id: routeId, tenantId, appType } });
    if (!route) return { success: false, error: 'Invalid route selection' };
  }

  // Validate agentId belongs to this tenant and is an active agent
  if (agentId) {
    const agent = await prisma.user.findFirst({
      where: { id: agentId, tenantId, role: 'agent', status: 'active' },
    });
    if (!agent) return { success: false, error: 'Invalid agent selection' };
  }

  const profilePhotoFile = formData.get('profilePhoto') as File | null;
  const existingProfilePhoto = formData.get('existingProfilePhoto') as string | null;
  let profilePhoto: string | null = null;
  if (profilePhotoFile && profilePhotoFile.size > 0) {
    profilePhoto = await saveUploadedFile(profilePhotoFile, tenantId, 'profiles');
  } else if (existingProfilePhoto) {
    profilePhoto = existingProfilePhoto;
  }

  // Company logo / photo
  const companyLogoFile = formData.get('companyLogo') as File | null;
  const existingCompanyLogo = formData.get('existingCompanyLogo') as string | null;
  let companyLogo: string | null = null;
  if (companyLogoFile && companyLogoFile.size > 0) {
    companyLogo = await saveUploadedFile(companyLogoFile, tenantId, 'companies');
  } else if (existingCompanyLogo) {
    companyLogo = existingCompanyLogo;
  }

  // Process documents
  const documents: any[] = [];
  const docsFiles = formData.getAll('documents') as File[];
  for (const file of docsFiles) {
    if (file && file.size > 0) {
      const savedPath = await saveUploadedFile(file, tenantId, 'kyc');
      documents.push({
        docType: 'other',
        fileName: file.name,
        filePath: savedPath,
        fileSize: file.size
      });
    }
  }

  // Process guarantors
  const guarantors: any[] = [];
  let g = 0;
  while (formData.has(`guarantorName_${g}`)) {
    const gName = formData.get(`guarantorName_${g}`) as string;
    const gPhone = formData.get(`guarantorPhone_${g}`) as string;
    const gRelation = formData.get(`guarantorRelation_${g}`) as string;
    const gAddress = formData.get(`guarantorAddress_${g}`) as string;
    const gPhotoFile = formData.get(`guarantorPhoto_${g}`) as File | null;
    let gPhoto = null;
    if (gPhotoFile && gPhotoFile.size > 0) {
      gPhoto = await saveUploadedFile(gPhotoFile, tenantId, 'guarantors');
    }
    if (gName && gPhone) {
      guarantors.push({ name: gName, phone: gPhone, relation: gRelation, address: gAddress, photo: gPhoto });
    }
    g++;
  }

  // Process cheques
  const cheques: any[] = [];
  let i = 0;
  while (formData.has(`bankName_${i}`)) {
    const bankName = formData.get(`bankName_${i}`) as string;
    const chequeNumber = formData.get(`chequeNumber_${i}`) as string;
    const file = formData.get(`chequeImage_${i}`) as File | null;
    let imagePath = null;
    if (file && file.size > 0) {
      imagePath = await saveUploadedFile(file, tenantId, 'cheques');
    }

    if (bankName && chequeNumber) {
      cheques.push({ bankName, chequeNumber, imagePath });
    }
    i++;
  }

  let customerId = editId;
  let savedCustomer = null;

  // Check for duplicate name (within the same tenant)
  const existingName = await prisma.customer.findFirst({
    where: { 
      tenantId, 
      name, 
      id: editId ? { not: editId } : undefined 
    }
  });

  if (existingName) {
    return { success: false, error: `A customer named "${name}" already exists. Please verify if this is a duplicate.` };
  }

  if (editId) {
    // Agents cannot edit directly
    if (userRole === 'agent') {
      return { success: false, error: 'Agents cannot edit customers directly. Please submit an approval request.' };
    }
    
    // Update existing
    savedCustomer = await prisma.customer.update({
      where: { id: editId, tenantId },
      data: {
        name, phone, address, routeId, agentId,
        ...(encryptedAadharNumber !== undefined ? { aadharNumber: encryptedAadharNumber } : {}),
        profilePhoto: profilePhoto ?? undefined,
        email,
        pan,
        companyName,
        companyType,
        occupation,
        monthlyIncome,
        gstNumber,
        businessType,
        companyLogo: companyLogo ?? undefined,
        companyPan,
        companyRegNo,
        companyAddress,
        companyPhone,
        companyEmail,
        designation,
      },
      include: { route: true }
    });

    // Update cheques (simple delete all and recreate for prototype)
    await prisma.securityCheque.deleteMany({ where: { customerId: editId } });
    if (cheques.length > 0) {
      await prisma.securityCheque.createMany({
        data: cheques.map(c => ({ ...c, customerId: editId }))
      });
    }

    // Update guarantors
    await prisma.guarantor.deleteMany({ where: { customerId: editId } });
    if (guarantors.length > 0) {
      await prisma.guarantor.createMany({
        data: guarantors.map(g => ({ ...g, customerId: editId }))
      });
    }

    // Update documents
    if (documents.length > 0) {
      await prisma.kycDocument.createMany({
        data: documents.map(d => ({ ...d, customerId: editId }))
      });
    }
  } else {
    // Create new
    // Generate Customer Code — format: <ROUTE_ABBR>-<GLOBAL_PREFIX><SEQ>
    // e.g. if route name is "Erode" and prefix is "CUS" → ER-CUS-0001
    const prefix = await getSetting(tenantId, 'customer_code_prefix', 'CUS');
    const counterStr = await getSetting(tenantId, 'customer_code_counter', '0');
    const counter = parseInt(counterStr) + 1;

    // Derive 2-letter abbreviation from route name (first 2 uppercase letters)
    let routeAbbr = '';
    if (routeId) {
      const route = await prisma.route.findUnique({ where: { id: routeId }, select: { name: true } });
      if (route?.name) {
        routeAbbr = route.name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
      }
    }
    const customerCode = routeAbbr
      ? `${routeAbbr}-${prefix}-${String(counter).padStart(4, '0')}`
      : `${prefix}-${String(counter).padStart(4, '0')}`;
    
    // Save new counter (upsert in case the row doesn't exist yet)
    await prisma.appSetting.upsert({
      where: { tenantId_key: { tenantId, key: 'customer_code_counter' } },
      update: { value: counter.toString() },
      create: { tenantId, key: 'customer_code_counter', value: counter.toString() },
    });

    savedCustomer = await prisma.customer.create({
      data: {
        tenantId,
        customerCode,
        name,
        phone,
        address,
        ...(encryptedAadharNumber !== undefined ? { aadharNumber: encryptedAadharNumber } : {}),
        routeId,
        agentId,
        appType,
        branchId: activeBranchId,
        email,
        pan,
        companyName,
        companyType,
        occupation,
        monthlyIncome,
        gstNumber,
        businessType,
        companyPan,
        companyRegNo,
        companyAddress,
        companyPhone,
        companyEmail,
        designation,
        status: userRole === 'agent' ? 'pending_review' : 'active',
        ...(profilePhoto ? { profilePhoto } : {}),
        ...(companyLogo ? { companyLogo } : {}),
        securityCheques: {
          create: cheques
        },
        guarantors: {
          create: guarantors
        },
        kycDocuments: {
          create: documents
        }
      },
      include: { route: true }
    });
    customerId = savedCustomer.id;
  }

  // Log action - only if userId is valid
  if (userId) {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: editId ? 'update' : 'create',
          entityType: 'customer',
          entityId: customerId!,
          newValue: JSON.stringify({ 
            customerCode: savedCustomer.customerCode, 
            name: savedCustomer.name, 
            status: savedCustomer.status 
          }),
        },
      });
    } catch (e) {
      console.error('Failed to create audit log:', e);
    }
  }

  // Create system notification for agents' customer creations
  if (userRole === 'agent' && activeBranchId && savedCustomer) {
    await prisma.systemNotification.create({
      data: {
        tenantId,
        branchId: activeBranchId,
        appType,
        type: 'customer_review',
        icon: 'people',
        title: 'Customer pending review',
        message: `Agent submitted customer ${name} for approval.`,
        link: modulePath(appType, '/approvals'),
        targetRole: 'admin',
      },
    }).catch(() => {});
  }

  if (isPopup) {
    return { success: true, customer: savedCustomer };
  }

  revalidatePath(modulePath(appType, '/customers'));
  redirect(modulePath(appType, `/customers/${savedCustomer.customerCode}`));
}

export async function requestCustomerEdit(customerId: string, requestedChanges: any, reason: string) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const session = await auth();
  const userId = session?.user?.id;
  const agentBranchId = await getActiveBranchId();

  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Verify the customer belongs to this tenant before accepting the request
  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) {
    return { success: false, error: 'Customer not found' };
  }

  await prisma.approvalRequest.create({
    data: {
      tenantId,
      appType,
      requestType: 'customer_edit',
      entityType: 'customer',
      entityId: customerId,
      requestedById: userId,
      requestedChanges: JSON.stringify({
        ...requestedChanges,
        ...(requestedChanges?.aadharNumber !== undefined
          ? { aadharNumber: encryptAadharNumber(String(requestedChanges.aadharNumber || '')) }
          : {}),
      }),
      reason,
      status: 'pending'
    }
  });

  // Create system notification for customer edit request
  const notifBranchId = agentBranchId || customer.branchId;
  await prisma.systemNotification.create({
    data: {
      tenantId,
      branchId: notifBranchId,
      appType,
      type: 'customer_edit_review',
      icon: 'verified',
      title: 'Customer edit pending review',
      message: `Agent requested edits for customer ${customer.name}.`,
      link: modulePath(appType, '/approvals'),
      targetRole: 'admin',
    },
  }).catch(() => {});

  revalidatePath('/customers');
  return { success: true };
}

export async function resetCustomerPassword(customerId: string) {
  const tenantId = await getDefaultTenantId();
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'agent';

  if (userRole !== 'superadmin' && userRole !== 'admin') {
    return { success: false, error: 'Unauthorized: Only admins can reset customer passwords.' };
  }

  try {
    await prisma.customer.update({
      where: { id: customerId, tenantId },
      data: {
        passwordHash: null,
      },
    });

    // Create an audit log entry for security
    const userId = session?.user?.id;
    if (userId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'reset_borrower_password',
          entityType: 'customer',
          entityId: customerId,
          newValue: JSON.stringify({ action: 'password_reset_to_null' }),
        },
      }).catch((e) => console.error('Failed to log audit for password reset:', e));
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to reset borrower password:', err);
    return { success: false, error: 'Internal database error.' };
  }
}
