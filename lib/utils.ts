import { Decimal } from '@prisma/client/runtime/library';

// ─── Currency Formatting ──────────────────────
export function formatCurrency(amount: number | Decimal | string, symbol: string = '₹'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : typeof amount === 'number' ? amount : amount.toNumber();
  const candidateSymbol = typeof symbol === 'string' ? symbol : '';
  const safeSymbol = candidateSymbol.trim() && candidateSymbol.trim() !== '???' ? candidateSymbol : '₹';
  return safeSymbol + num.toLocaleString('en-IN');
}

// ─── Date Formatting ──────────────────────────
export function formatDate(date: Date | string | null, format: string = 'dd MMM yyyy'): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const day = String(d.getDate()).padStart(2, '0');
  const monthShort = d.toLocaleDateString('en-IN', { month: 'short' });
  const monthLong = d.toLocaleDateString('en-IN', { month: 'long' });
  const year = d.getFullYear();
  const weekday = d.toLocaleDateString('en-IN', { weekday: 'long' });

  return format
    .replace('dd', day)
    .replace('MMMM', monthLong)
    .replace('MMM', monthShort)
    .replace('yyyy', String(year))
    .replace('dddd', weekday);
}

export function formatDateLong(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', { 
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' 
  });
}

export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function todayISO(): string {
  return formatDateISO(new Date());
}

// ─── Code Generation ──────────────────────────
export function generateCode(prefix: string, sequence: number, padLength: number = 3): string {
  return prefix + String(sequence).padStart(padLength, '0');
}

// ─── Badge Class Helper ───────────────────────
export function getBadgeClass(status: string): string {
  const map: Record<string, string> = {
    active: 'badge-active',
    paid: 'badge-paid',
    overdue: 'badge-overdue',
    missed: 'badge-missed',
    closed: 'badge-closed',
    upcoming: 'badge-upcoming',
    'due today': 'badge-due-today',
    pending: 'badge-pending',
    waived: 'badge-waived',
    settled: 'badge-active',
    partial: 'badge-pending',
    verified: 'badge-active',
    rejected: 'badge-missed',
    suspended: 'badge-missed',
    inactive: 'badge-closed',
    open: 'badge-upcoming',
    locked: 'badge-closed',
  };
  return 'badge ' + (map[status.toLowerCase()] || 'badge-pending');
}

// ─── Initials Helper ──────────────────────────
export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Percentage Helper ────────────────────────
export function calcPercentage(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}

// ─── Loan Calculation Helpers ─────────────────
export function calculateEndDate(startDate: Date, frequency: string, tenure: number): Date {
  const end = new Date(startDate);
  if (frequency === 'daily') end.setDate(end.getDate() + tenure);
  else if (frequency === 'weekly') end.setDate(end.getDate() + tenure * 7);
  else if (frequency === 'biweekly') end.setDate(end.getDate() + tenure * 14);
  else end.setMonth(end.getMonth() + tenure);
  return end;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function calculateInstalmentDates(startDate: Date, frequency: string, tenure: number, dueDay?: number | null): Date[] {
  const dates: Date[] = [];

  if (frequency === 'daily' || dueDay == null) {
    // Daily: every day; or no dueDay specified: use original simple logic
    for (let i = 0; i < tenure; i++) {
      const d = new Date(startDate);
      if (frequency === 'daily') d.setDate(d.getDate() + i);
      else if (frequency === 'weekly') d.setDate(d.getDate() + i * 7);
      else if (frequency === 'biweekly') d.setDate(d.getDate() + i * 14);
      else {
        const targetMonth = startDate.getMonth() + i;
        const targetYear = startDate.getFullYear() + Math.floor(targetMonth / 12);
        const normalizedMonth = ((targetMonth % 12) + 12) % 12;
        const clampedDay = Math.min(startDate.getDate(), daysInMonth(targetYear, normalizedMonth));
        d.setFullYear(targetYear, normalizedMonth, clampedDay);
      }
      dates.push(d);
    }
    return dates;
  }

  if (frequency === 'weekly' || frequency === 'biweekly') {
    // dueDay is 0-6 (Sun-Sat). Find the first occurrence on/after startDate.
    const first = new Date(startDate);
    const currentDay = first.getDay();
    let diff = dueDay - currentDay;
    if (diff < 0) diff += 7;
    first.setDate(first.getDate() + diff);

    const step = frequency === 'biweekly' ? 14 : 7;
    for (let i = 0; i < tenure; i++) {
      const d = new Date(first);
      d.setDate(d.getDate() + i * step);
      dates.push(d);
    }
  } else if (frequency === 'monthly') {
    // dueDay is 1-28 (day of month)
    const clampedDay = Math.min(28, Math.max(1, dueDay));
    const startMonth = startDate.getMonth();
    const startYear = startDate.getFullYear();
    // If the start date's day is already past the dueDay, start from next month
    let monthOffset = startDate.getDate() > clampedDay ? 1 : 0;

    for (let i = 0; i < tenure; i++) {
      const d = new Date(startYear, startMonth + monthOffset + i, clampedDay);
      dates.push(d);
    }
  }

  return dates;
}

// ─── API Response Helpers ─────────────────────
export function apiSuccess<T>(data: T, message?: string) {
  return Response.json({ success: true, data, message }, { status: 200 });
}

export function apiError(message: string, status: number = 400) {
  return Response.json({ success: false, error: message }, { status });
}

export function apiCreated<T>(data: T, message?: string) {
  return Response.json({ success: true, data, message }, { status: 201 });
}

// ─── Pagination Helper ────────────────────────
export function parsePagination(searchParams: any) {
  let p = '1';
  let l = '20';
  if (searchParams && typeof searchParams.get === 'function') {
    p = searchParams.get('page') || '1';
    l = searchParams.get('limit') || '20';
  } else if (searchParams) {
    p = searchParams.page || '1';
    l = searchParams.limit || '20';
  }
  const page = Math.max(1, parseInt(p));
  const limit = Math.min(100, Math.max(1, parseInt(l)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    }
  };
}

export type PaginationPageItem = number | 'ellipsis';
export function getPaginationPages(page: number, totalPages: number): PaginationPageItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: PaginationPageItem[] = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(totalPages - 1, page + 1);

  if (left > 2) {
    pages.push('ellipsis');
  } else {
    for (let i = 2; i < left; i++) {
      pages.push(i);
    }
  }

  for (let i = left; i <= right; i++) {
    pages.push(i);
  }

  if (right < totalPages - 1) {
    pages.push('ellipsis');
  } else {
    for (let i = right + 1; i < totalPages; i++) {
      pages.push(i);
    }
  }

  pages.push(totalPages);
  return pages;
}
