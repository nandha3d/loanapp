'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

async function saveUploadedFile(file: File, subfolder: string): Promise<string> {
  const dir = path.join(UPLOAD_DIR, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(file.name) || '';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(dir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${subfolder}/${safeName}`;
}

export async function saveCustomer(formData: FormData) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'agent';
  const userId = session?.user?.id;
  const editId = formData.get('id') as string | null;
  
  const name = formData.get('name') as string;
  const phone = formData.get('phone') as string;
  const address = formData.get('address') as string;
  const routeId = formData.get('routeId') as string;
  const agentId = formData.get('agentId') as string;

  const isPopup = formData.get('isPopup') === 'true';

  const profilePhotoFile = formData.get('profilePhoto') as File | null;
  const existingProfilePhoto = formData.get('existingProfilePhoto') as string | null;
  let profilePhoto: string | null = null;
  if (profilePhotoFile && profilePhotoFile.size > 0) {
    profilePhoto = await saveUploadedFile(profilePhotoFile, 'profiles');
  } else if (existingProfilePhoto) {
    profilePhoto = existingProfilePhoto;
  }

  // Process documents
  const documents: any[] = [];
  const docsFiles = formData.getAll('documents') as File[];
  for (const file of docsFiles) {
    if (file && file.size > 0) {
      const savedPath = await saveUploadedFile(file, 'kyc');
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
      gPhoto = await saveUploadedFile(gPhotoFile, 'guarantors');
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
      imagePath = await saveUploadedFile(file, 'cheques');
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
        profilePhoto: profilePhoto ?? undefined,
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
    
    // Save new counter
    await prisma.appSetting.update({
      where: { tenantId_key: { tenantId, key: 'customer_code_counter' } },
      data: { value: counter.toString() }
    });

    savedCustomer = await prisma.customer.create({
      data: {
        tenantId,
        customerCode,
        name,
        phone,
        address,
        routeId,
        agentId,
        appType,
        status: userRole === 'agent' ? 'pending_review' : 'active',
        ...(profilePhoto ? { profilePhoto } : {}),
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

  if (isPopup) {
    return { success: true, customer: savedCustomer };
  }

  revalidatePath('/customers');
  redirect(`/customers/${customerId}`);
}

export async function requestCustomerEdit(customerId: string, requestedChanges: any, reason: string) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  await prisma.approvalRequest.create({
    data: {
      tenantId,
      appType,
      requestType: 'customer_edit',
      entityType: 'customer',
      entityId: customerId,
      requestedById: userId,
      requestedChanges: JSON.stringify(requestedChanges),
      reason,
      status: 'pending'
    }
  });

  revalidatePath('/customers');
  return { success: true };
}
