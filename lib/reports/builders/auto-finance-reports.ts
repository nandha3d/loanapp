import prisma from '../../db';
import type { ReportBuilderParams, ReportPayload } from '../types';

function vehicleWhere(params: ReportBuilderParams) {
  return {
    tenantId: params.tenantId,
    appType: params.appType,
    deletedAt: null,
    ...(params.branchId ? { loan: { branchId: params.branchId } } : {}),
  };
}

const vehicleInclude = {
  customer: { select: { name: true, customerCode: true } },
  loan: { select: { loanCode: true, principal: true, status: true } },
} as const;

export async function buildVehicleHypothecationReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const vehicles = await prisma.vehicle.findMany({
    where: vehicleWhere(params),
    include: vehicleInclude,
    orderBy: { registrationNo: 'asc' },
  });

  return {
    title: 'Vehicle Hypothecation Report',
    columns: [
      { key: 'registrationNo', label: 'Registration No.', type: 'text' },
      { key: 'vehicle', label: 'Vehicle', type: 'text' },
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'loanCode', label: 'Loan Code', type: 'text' },
      { key: 'principal', label: 'Principal', type: 'currency', align: 'right', total: true },
      { key: 'loanStatus', label: 'Loan Status', type: 'badge', align: 'center' },
      { key: 'vehicleStatus', label: 'Vehicle Status', type: 'badge', align: 'center' },
    ],
    rows: vehicles.map((vehicle) => ({
      registrationNo: vehicle.registrationNo,
      vehicle: `${vehicle.make} ${vehicle.model}`.trim(),
      customer: vehicle.customer.name,
      loanCode: vehicle.loan?.loanCode ?? '—',
      principal: Number(vehicle.loan?.principal ?? 0),
      loanStatus: vehicle.loan?.status ?? 'unlinked',
      vehicleStatus: vehicle.status,
    })),
    totals: { principal: vehicles.reduce((total, vehicle) => total + Number(vehicle.loan?.principal ?? 0), 0) },
    meta: { currencySymbol: '₹' },
  };
}

export async function buildInsuranceExpiryReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const dateFrom = new Date(params.from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(params.to);
  dateTo.setHours(23, 59, 59, 999);
  const vehicles = await prisma.vehicle.findMany({
    where: {
      ...vehicleWhere(params),
      insuranceExpiry: { lte: dateTo },
    },
    include: vehicleInclude,
    orderBy: { insuranceExpiry: 'asc' },
  });

  return {
    title: 'Insurance Expiry Report',
    columns: [
      { key: 'registrationNo', label: 'Registration No.', type: 'text' },
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'insuranceExpiry', label: 'Insurance Expiry', type: 'date' },
      { key: 'expiryStatus', label: 'Expiry Status', type: 'badge', align: 'center' },
      { key: 'loanCode', label: 'Loan Code', type: 'text' },
    ],
    rows: vehicles.map((vehicle) => ({
      registrationNo: vehicle.registrationNo,
      customer: vehicle.customer.name,
      insuranceExpiry: vehicle.insuranceExpiry,
      expiryStatus: vehicle.insuranceExpiry && vehicle.insuranceExpiry < dateFrom ? 'expired' : 'expiring',
      loanCode: vehicle.loan?.loanCode ?? '—',
    })),
    meta: { currencySymbol: '₹' },
  };
}

export async function buildSeizureRepoReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const vehicles = await prisma.vehicle.findMany({
    where: { ...vehicleWhere(params), repoFlag: true },
    include: vehicleInclude,
    orderBy: { repoFlaggedAt: 'desc' },
  });

  return {
    title: 'Seizure & Repo Report',
    columns: [
      { key: 'registrationNo', label: 'Registration No.', type: 'text' },
      { key: 'vehicle', label: 'Vehicle', type: 'text' },
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'loanCode', label: 'Loan Code', type: 'text' },
      { key: 'flaggedAt', label: 'Repo Flagged At', type: 'date' },
      { key: 'status', label: 'Status', type: 'badge', align: 'center' },
    ],
    rows: vehicles.map((vehicle) => ({
      registrationNo: vehicle.registrationNo,
      vehicle: `${vehicle.make} ${vehicle.model}`.trim(),
      customer: vehicle.customer.name,
      loanCode: vehicle.loan?.loanCode ?? '—',
      flaggedAt: vehicle.repoFlaggedAt,
      status: vehicle.status,
    })),
    meta: { currencySymbol: '₹' },
  };
}
