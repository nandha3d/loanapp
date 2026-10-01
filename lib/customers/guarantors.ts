import { encryptAadharNumber, isMaskedAadharNumber } from '@/lib/pii';

export interface MappedGuarantor {
  id?: string;
  name: string;
  phone: string;
  relation?: string | null;
  address?: string | null;
  photo?: string | null;
  aadharNumber?: string | null;
  notes?: string | null;
}

export function mapGuarantorInput(g: any): MappedGuarantor {
  const rawAadhar = g.aadharNumber != null && String(g.aadharNumber).trim() !== ''
    ? String(g.aadharNumber).trim()
    : null;
  const encryptedAadhar =
    rawAadhar && !isMaskedAadharNumber(rawAadhar)
      ? encryptAadharNumber(rawAadhar)
      : null;

  return {
    id: g.id ? String(g.id) : undefined,
    name: String(g.name ?? '').trim(),
    phone: String(g.phone ?? '').trim(),
    relation: g.relation ? String(g.relation).trim() : null,
    address: g.address ? String(g.address).trim() : null,
    photo: g.photoUrl ?? g.photo ? String(g.photoUrl ?? g.photo) : null,
    aadharNumber: encryptedAadhar,
    notes: g.notes ? String(g.notes) : null,
  };
}

export function mapGuarantorCreateInput(g: any) {
  const mapped = mapGuarantorInput(g);
  return {
    name: mapped.name,
    phone: mapped.phone,
    relation: mapped.relation ?? null,
    address: mapped.address ?? null,
    photo: mapped.photo ?? null,
    aadharNumber: mapped.aadharNumber ?? null,
    notes: mapped.notes ?? null,
  };
}

export async function syncGuarantorsInPlace(
  tx: any,
  customerId: string,
  incomingGuarantors: any[]
) {
  const existingGuarantors = await tx.guarantor.findMany({
    where: { customerId },
  });

  const validIncoming = incomingGuarantors
    .filter((g: any) => g && g.name && g.phone)
    .map(mapGuarantorInput);

  const matchedExistingIds = new Set<string>();

  for (const g of validIncoming) {
    let matched = existingGuarantors.find(
      (e: any) => g.id && e.id === g.id && !matchedExistingIds.has(e.id)
    );
    if (!matched) {
      matched = existingGuarantors.find(
        (e: any) =>
          !matchedExistingIds.has(e.id) &&
          e.name.trim().toLowerCase() === g.name.toLowerCase() &&
          e.phone.trim() === g.phone
      );
    }

    if (matched) {
      matchedExistingIds.add(matched.id);
      await tx.guarantor.update({
        where: { id: matched.id },
        data: {
          name: g.name,
          phone: g.phone,
          relation: g.relation !== undefined ? g.relation : matched.relation,
          address: g.address !== undefined ? g.address : matched.address,
          photo: g.photo || matched.photo,
          aadharNumber: g.aadharNumber || matched.aadharNumber,
          notes: g.notes || matched.notes,
        },
      });
    } else {
      await tx.guarantor.create({
        data: {
          customerId,
          name: g.name,
          phone: g.phone,
          relation: g.relation ?? null,
          address: g.address ?? null,
          photo: g.photo ?? null,
          aadharNumber: g.aadharNumber ?? null,
          notes: g.notes ?? null,
        },
      });
    }
  }

  for (const e of existingGuarantors) {
    if (!matchedExistingIds.has(e.id)) {
      await tx.guarantor.delete({
        where: { id: e.id },
      });
    }
  }
}
