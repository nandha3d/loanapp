'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency, formatDate, getBadgeClass, getInitials, getPaginationPages } from '@/lib/utils';
import { submitCollectionEntry, submitLoanCollection, requestCollectionEdit, requestCashHandover, pingAgentLocation } from './actions';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';

type CollectionRow = {
  id: string;
  instalmentNo: number;
  dueDate: string;
  dueAmount: number;
  receivedAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  daysOverdue: number;
  status: string;
  loan: {
    id: string;
    loanCode: string;
    totalPayable: number;
    totalCollected: number;
    principal: number;
    totalInstalments: number;
    paidCount: number;
    perInstalment: number;
    frequency: string;
    customer: {
      id: string;
      name: string;
      customerCode: string;
      phone?: string | null;
      preferredCollectionTime?: string | null;
      route?: { id: string; name: string } | null;
      collectionPoints?: { id: string; name: string; address: string; latitude: number | null; longitude: number | null; isPrimary: boolean }[];
    };
  };
  collectionEntry?: { id: string } | null;
};

type RouteOption = {
  id: string;
  name: string;
};

type CollectionSummary = {
  todayExpected: number;
  todayCollected: number;
  todayOutstanding: number;
  todayPendingCount: number;
  todayPaidCount: number;
  overdueTotalTillToday: number;
  overdueCollectedToday: number;
  overdueOutstanding: number;
  overduePendingCount: number;
};

type UnifiedGroup = {
  customerId: string;
  customerName: string;
  customerCode: string;
  customerPhone?: string | null;
  routeName: string;
  preferredCollectionTime?: string | null;
  instalments: CollectionRow[];
  loanCodes: string[];
  collectionPoints: { id: string; name: string; address: string; latitude: number | null; longitude: number | null; isPrimary: boolean }[];
  distanceToAgent?: number;
  nearestPointName?: string;
  mapLat?: number;
  mapLng?: number;
};

type CustomerOverdueGroup = {
  customerId: string;
  customerName: string;
  customerCode: string;
  routeName: string;
  instalments: CollectionRow[];
  loanCodes: string[];
  earliestDueDate: string;
  dueToday: number;
  receivedAmount: number;
  totalOutstanding: number;
  totalOverdue: number;
  maxDaysOverdue: number;
  statusLabel: string;
};

type BrowserGpsCapture = {
  status: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  altitude?: number | null;
  timestamp?: string;
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getIstDateStr(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLocalDateStr(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Single source of truth for an instalment's *displayed* status. The DB `status`
// column lags reality — an instalment stays 'upcoming' until a nightly batch job
// flips it to 'missed' — so we derive from money + due date instead. Crucially, an
// instalment due TODAY is "Due Today" (today isn't over yet) and is NEVER counted
// as overdue/missed.
function deriveInstalmentStatus(
  inst: { dueDate: string; receivedAmount: number; outstandingAmount: number; daysOverdue: number },
  todayStr: string,
): { key: string; label: string } {
  if (inst.outstandingAmount <= 0 && inst.receivedAmount > 0) return { key: 'paid', label: 'Paid' };
  if (inst.receivedAmount > 0 && inst.daysOverdue === 0) return { key: 'partial', label: 'Partial' };
  if (inst.daysOverdue > 0) return { key: 'missed', label: 'Missed' };
  const dueIst = getIstDateStr(inst.dueDate);
  if (dueIst > todayStr) return { key: 'upcoming', label: 'Upcoming' };
  return { key: 'due today', label: 'Due Today' };
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function CollectionClient({
  todayInstalments,
  overdueInstalments,
  routes,
  agentName,
  agentRole,
  routeName,
  currencySymbol,
  dict,
  dailyCollection,
  collectionSummary,
  receiptPdfEnabled = false,
  gpsTrackingEnabled = false,
}: {
  todayInstalments: CollectionRow[];
  overdueInstalments: CollectionRow[];
  routes: RouteOption[];
  agentName: string;
  agentRole: string;
  routeName: string;
  currencySymbol: string;
  dict: any;
  dailyCollection: { id: string; status: string; totalCollected: number } | null;
  collectionSummary: CollectionSummary;
  receiptPdfEnabled?: boolean;
  gpsTrackingEnabled?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modal, setModal] = useState<CollectionRow | null>(null);
  const [overdueCustomerGroup, setOverdueCustomerGroup] = useState<CustomerOverdueGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(0);
  // Which preset card the agent picked in the collect popup ('today' | 'total').
  const [selectedCard, setSelectedCard] = useState<'today' | 'total'>('today');
  const [mode, setMode] = useState('cash');
  const [remarks, setRemarks] = useState('');
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState(() => searchParams.get('date') || '');
  const [customerFilter, setCustomerFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState(() => searchParams.get('routeId') || searchParams.get('route') || '');
  const [statusFilter, setStatusFilter] = useState('');

  const handleRouteChange = useCallback((selectedRouteId: string) => {
    setRouteFilter(selectedRouteId);
    setPage(1);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (selectedRouteId) {
        params.set('routeId', selectedRouteId);
        params.delete('route');
      } else {
        params.delete('routeId');
        params.delete('route');
      }
      const newQuery = params.toString();
      window.history.replaceState(null, '', newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname);
    }
  }, []);
  const initialTab: 'all' | 'today' | 'overdue' = useMemo(() => {
    const tab = searchParams.get('tab');
    if (tab === 'overdue') return 'overdue';
    if (tab === 'all') return 'all';
    // Default to today's worklist — the agent's day-to-day view.
    return 'today';
  }, [searchParams]);

  const [typeFilter, setTypeFilter] = useState<'all' | 'today' | 'overdue'>(initialTab);
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [overdueMinDays, setOverdueMinDays] = useState('');
  const [overdueMaxDays, setOverdueMaxDays] = useState('');
  const [selectedLoanForCustomer, setSelectedLoanForCustomer] = useState<Record<string, string>>({});
  // Which customer rows are expanded to reveal their per-loan sub-rows.
  const [viewMode, setViewMode] = useState<'instalments' | 'grouped'>('instalments');
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const toggleCustomerExpand = (customerId: string) =>
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId); else next.add(customerId);
      return next;
    });
  const [gpsStatusText, setGpsStatusText] = useState('');
  const [agentLocation, setAgentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isSortedByNearest, setIsSortedByNearest] = useState(false);

  const handleLoanChange = (customerId: string, loanCode: string) => {
    setSelectedLoanForCustomer(prev => ({ ...prev, [customerId]: loanCode }));
  };

  const isAdmin = agentRole === 'admin' || agentRole === 'superadmin';
  const modalRef = useRef<HTMLDivElement>(null);
  const todayISO = useMemo(() => getIstDateStr(new Date()), []);

  // Browser-agent tracking: agents using the mobile-browser view (not the APK)
  // stream location pings while this page is open, so they show up on the
  // Agent Tracking map/log exactly like app users. Batched and flushed every
  // 30s — same cadence as the app's GpsPinger.
  useEffect(() => {
    if (agentRole !== 'agent' || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const buffer: { lat: number; lng: number; accuracyM?: number; speedMps?: number; capturedAt?: string }[] = [];
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        buffer.push({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy ?? undefined,
          speedMps: pos.coords.speed ?? undefined,
          capturedAt: new Date(pos.timestamp).toISOString(),
        });
        if (buffer.length > 100) buffer.splice(0, buffer.length - 100);
      },
      () => {}, // denied/unavailable — entry-level GPS capture still applies
      { enableHighAccuracy: false, maximumAge: 15000 },
    );
    const flush = setInterval(() => {
      if (buffer.length === 0) return;
      const batch = buffer.splice(0, buffer.length);
      pingAgentLocation(batch).catch(() => {
        buffer.unshift(...batch.slice(-100));
      });
    }, 30_000);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(flush);
    };
  }, [agentRole]);

  // DEF-031 / DEF-032: Trap focus within modal and close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modal) {
          setModal(null);
        } else if (overdueCustomerGroup) {
          setOverdueCustomerGroup(null);
        }
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement>;
        
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };
    
    if (modal || overdueCustomerGroup) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus first element on open
      setTimeout(() => {
        if (modalRef.current) {
          const firstInput = modalRef.current.querySelector('input, button, a') as HTMLElement;
          if (firstInput) firstInput.focus();
        }
      }, 50);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [modal, overdueCustomerGroup]);

  // Merge both arrays, deduplicate by id
  const allInstalments = useMemo(() => {
    const map = new Map<string, CollectionRow & { source: 'today' | 'overdue' }>();
    for (const row of todayInstalments) {
      map.set(row.id, { ...row, source: 'today' as const });
    }
    for (const row of overdueInstalments) {
      if (!map.has(row.id)) {
        map.set(row.id, { ...row, source: 'overdue' as const });
      }
    }
    return Array.from(map.values());
  }, [todayInstalments, overdueInstalments]);

  // Helper to test if a row matches the selected route (by ID or Name)
  const rowMatchesRoute = useCallback((row: CollectionRow, targetRoute: string) => {
    if (!targetRoute) return true;
    const custRouteId = row.loan?.customer?.route?.id || (row.loan?.customer as any)?.routeId;
    const custRouteName = row.loan?.customer?.route?.name;
    return custRouteId === targetRoute || custRouteName === targetRoute;
  }, []);

  // Complete list of routes available for switching: merge server routes + any unique route found in worklist
  const availableRoutes = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const r of routes) {
      if (r?.id && r?.name) {
        map.set(r.id, { id: r.id, name: r.name });
      }
    }
    for (const row of allInstalments) {
      const r = row.loan?.customer?.route;
      if (r?.id && r?.name && !map.has(r.id)) {
        map.set(r.id, { id: r.id, name: r.name });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [routes, allInstalments]);

  // Route customer & dues breakdown for badges and quick switcher
  const routeStats = useMemo(() => {
    const stats: Record<string, { customerIds: Set<string>; todayCount: number; overdueCount: number; todayDue: number; overdueAmount: number }> = {};
    for (const r of availableRoutes) {
      stats[r.id] = { customerIds: new Set(), todayCount: 0, overdueCount: 0, todayDue: 0, overdueAmount: 0 };
    }
    for (const row of allInstalments) {
      const rId = row.loan?.customer?.route?.id;
      if (rId && stats[rId]) {
        stats[rId].customerIds.add(row.loan.customer.id);
        if (row.source === 'today') {
          stats[rId].todayCount++;
          stats[rId].todayDue += row.dueAmount;
        } else {
          stats[rId].overdueCount++;
          stats[rId].overdueAmount += row.outstandingAmount;
        }
      }
    }
    return stats;
  }, [availableRoutes, allInstalments]);

  // Distinct customer count across all loaded instalments
  const totalDistinctCustomers = useMemo(() => {
    const s = new Set<string>();
    for (const row of allInstalments) {
      if (row.loan?.customer?.id) s.add(row.loan.customer.id);
    }
    return s.size;
  }, [allInstalments]);

  const activeRouteObj = useMemo(() => {
    if (!routeFilter) return null;
    return availableRoutes.find((r) => r.id === routeFilter || r.name === routeFilter) || null;
  }, [availableRoutes, routeFilter]);

  const filteredRows = useMemo(() => {
    return allInstalments.filter((row) => {
      // Mutual exclusion harmonisation:
      // If user specifically selects statusFilter === 'missed' or enters overdueMinDays > 0,
      // do not drop overdue rows even if typeFilter was left on 'today'.
      // If user specifically selects statusFilter === 'due today', do not drop today rows even if typeFilter was 'overdue'.
      // If user selects a dateFilter that differs from today, do not restrict to today's source.
      const isOverdueTargeted = statusFilter === 'missed' || (overdueMinDays !== '' && Number(overdueMinDays) > 0);
      const isTodayTargeted = statusFilter === 'due today';
      const isDateSpecific = Boolean(dateFilter && dateFilter !== todayISO);

      if (typeFilter === 'today' && !isOverdueTargeted && !isDateSpecific && row.source !== 'today') return false;
      if (typeFilter === 'overdue' && !isTodayTargeted && !isDateSpecific && row.source !== 'overdue') return false;

      // Due date comparison: match against IST date, local date, UTC ISO slice, or raw date string
      const istDate = getIstDateStr(row.dueDate);
      const localDate = getLocalDateStr(row.dueDate);
      const utcDate = new Date(row.dueDate).toISOString().slice(0, 10);
      const rawDate = typeof row.dueDate === 'string' ? row.dueDate.slice(0, 10) : '';
      const matchesDate = !dateFilter || istDate === dateFilter || localDate === dateFilter || utcDate === dateFilter || rawDate === dateFilter;

      // Customer / Loan search: search name, customerCode, phone, loanCode, and route name null-safely
      const search = customerFilter.trim().toLowerCase();
      const custName = (row.loan?.customer?.name || '').toLowerCase();
      const custCode = (row.loan?.customer?.customerCode || '').toLowerCase();
      const custPhone = (row.loan?.customer?.phone || '').toLowerCase();
      const loanCode = (row.loan?.loanCode || '').toLowerCase();
      const routeName = (row.loan?.customer?.route?.name || '').toLowerCase();
      const matchesCustomer = !search
        || custName.includes(search)
        || custCode.includes(search)
        || custPhone.includes(search)
        || loanCode.includes(search)
        || routeName.includes(search);

      // Route filter: match route ID, customer routeId, or route name
      const matchesRoute = rowMatchesRoute(row, routeFilter);

      // Status filter: handle both semantic meanings and status keys
      const statusInfo = deriveInstalmentStatus(row, todayISO);
      let matchesStatus = true;
      if (statusFilter) {
        if (statusFilter === 'missed') {
          matchesStatus = statusInfo.key === 'missed' || (row.daysOverdue > 0 && row.outstandingAmount > 0) || (row.source === 'overdue' && row.outstandingAmount > 0);
        } else if (statusFilter === 'due today') {
          matchesStatus = statusInfo.key === 'due today' || (row.source === 'today' && row.daysOverdue === 0 && row.outstandingAmount > 0);
        } else if (statusFilter === 'partial') {
          matchesStatus = statusInfo.key === 'partial' || (row.receivedAmount > 0 && row.outstandingAmount > 0);
        } else if (statusFilter === 'paid') {
          matchesStatus = statusInfo.key === 'paid' || (row.outstandingAmount <= 0 && row.receivedAmount > 0) || row.status === 'paid';
        } else if (statusFilter === 'upcoming') {
          matchesStatus = statusInfo.key === 'upcoming' || istDate > todayISO;
        } else {
          matchesStatus = statusInfo.key === statusFilter;
        }
      }

      // Frequency filter: case-insensitive and null-safe
      const matchesFrequency = !frequencyFilter || (row.loan?.frequency || '').toLowerCase() === frequencyFilter.toLowerCase();

      // Session filter: trim and support 'anytime' and 'other'
      const preferredSession = (row.loan?.customer?.preferredCollectionTime || '').toLowerCase().trim();
      const knownSessions = ['morning', 'afternoon', 'evening', 'night'];
      const matchesSession = !sessionFilter
        || (sessionFilter === 'anytime' && (!preferredSession || preferredSession === 'anytime'))
        || (sessionFilter === 'other' && !!preferredSession && !knownSessions.includes(preferredSession) && preferredSession !== 'anytime')
        || preferredSession === sessionFilter;

      // Overdue days range filter
      const minD = overdueMinDays !== '' && !isNaN(Number(overdueMinDays)) ? Number(overdueMinDays) : 0;
      const maxD = overdueMaxDays !== '' && !isNaN(Number(overdueMaxDays)) ? Number(overdueMaxDays) : Infinity;
      const matchesOverdueDays = row.daysOverdue >= minD && row.daysOverdue <= maxD;

      return matchesDate && matchesCustomer && matchesRoute && matchesStatus && matchesFrequency && matchesSession && matchesOverdueDays;
    });
  }, [allInstalments, typeFilter, customerFilter, dateFilter, routeFilter, statusFilter, frequencyFilter, sessionFilter, overdueMinDays, overdueMaxDays, todayISO]);

  const todayTotals = useMemo(() => {
    if (!routeFilter) {
      return {
        due: collectionSummary.todayExpected,
        collected: collectionSummary.todayCollected,
        outstanding: collectionSummary.todayOutstanding,
        pendingCount: collectionSummary.todayPendingCount,
      };
    }
    const routeTodayRows = todayInstalments.filter((r) => rowMatchesRoute(r, routeFilter));
    const due = routeTodayRows.reduce((sum, r) => sum + (Number(r.dueAmount) || 0), 0);
    const collected = routeTodayRows.reduce((sum, r) => sum + (Number(r.receivedAmount) || 0), 0);
    const outstanding = Math.max(0, due - collected);
    const pendingCount = routeTodayRows.filter((r) => r.outstandingAmount > 0).length;
    return { due, collected, outstanding, pendingCount };
  }, [collectionSummary, routeFilter, todayInstalments, rowMatchesRoute]);

  const overdueTotals = useMemo(() => {
    if (!routeFilter) {
      return {
        amount: collectionSummary.overdueOutstanding,
        dueTotal: collectionSummary.overdueTotalTillToday,
        recovered: collectionSummary.overdueCollectedToday,
        count: collectionSummary.overduePendingCount,
        maxDays: overdueInstalments.reduce((max, row) => Math.max(max, row.daysOverdue), 0),
      };
    }
    const routeOverdueRows = overdueInstalments.filter((r) => rowMatchesRoute(r, routeFilter));
    const amount = routeOverdueRows.reduce((sum, r) => sum + (Number(r.outstandingAmount) || 0), 0);
    const dueTotal = routeOverdueRows.reduce((sum, r) => sum + (Number(r.dueAmount) || 0), 0);
    const recovered = routeOverdueRows.reduce((sum, r) => sum + (Number(r.receivedAmount) || 0), 0);
    const count = routeOverdueRows.filter((r) => r.outstandingAmount > 0).length;
    const maxDays = routeOverdueRows.reduce((max, r) => Math.max(max, r.daysOverdue || 0), 0);
    return { amount, dueTotal, recovered, count, maxDays };
  }, [collectionSummary, overdueInstalments, routeFilter, rowMatchesRoute]);

  // Customer worklist progress for today: how many distinct customers due today
  // have had something collected. Drives the "Customers" completion bar.
  const customerProgress = useMemo(() => {
    const dueSet = new Set<string>();
    const doneSet = new Set<string>();
    const sourceRows = routeFilter
      ? todayInstalments.filter((r) => rowMatchesRoute(r, routeFilter))
      : todayInstalments;
    for (const row of sourceRows) {
      if (getIstDateStr(row.dueDate) !== todayISO && row.dueDate.slice(0, 10) !== todayISO) continue;
      const cid = row.loan.customer.id;
      dueSet.add(cid);
      if (row.outstandingAmount <= 0) doneSet.add(cid);
    }
    return { total: dueSet.size, done: doneSet.size };
  }, [todayInstalments, todayISO, routeFilter, rowMatchesRoute]);

  const pct = (num: number, den: number) => (den > 0 ? Math.min(100, Math.round((num / den) * 100)) : 0);

  const unifiedGroups = useMemo<UnifiedGroup[]>(() => {
    const map = new Map<string, UnifiedGroup>();
    for (const row of filteredRows) {
      const cid = row.loan.customer.id;
      if (!map.has(cid)) {
        map.set(cid, {
          customerId: cid,
          customerName: row.loan.customer.name,
          customerCode: row.loan.customer.customerCode,
          customerPhone: row.loan.customer.phone || null,
          routeName: row.loan.customer.route?.name || '-',
          preferredCollectionTime: row.loan.customer.preferredCollectionTime || null,
          instalments: [],
          loanCodes: [],
          collectionPoints: row.loan.customer.collectionPoints || [],
        });
      }
      const g = map.get(cid)!;
      g.instalments.push(row);
      if (!g.loanCodes.includes(row.loan.loanCode)) {
        g.loanCodes.push(row.loan.loanCode);
      }
    }
    for (const g of map.values()) {
      g.instalments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }
    
    const groups = Array.from(map.values()).sort((a, b) => a.customerName.localeCompare(b.customerName));

    for (const g of groups) {
      const withGps = g.collectionPoints.filter((cp) => cp.latitude != null && cp.longitude != null);
      const point = withGps.find((cp) => cp.isPrimary) || withGps[0];
      if (point) {
        g.mapLat = point.latitude!;
        g.mapLng = point.longitude!;
      }
    }

    if (isSortedByNearest && agentLocation) {
      groups.forEach(g => {
        let minDistance = Infinity;
        let nearestName = '';
        g.collectionPoints.forEach(cp => {
          if (cp.latitude && cp.longitude) {
            const dist = calculateHaversineDistance(agentLocation.latitude, agentLocation.longitude, cp.latitude, cp.longitude);
            if (dist < minDistance) {
              minDistance = dist;
              nearestName = cp.name;
            }
          }
        });
        if (minDistance !== Infinity) {
          g.distanceToAgent = minDistance;
          g.nearestPointName = nearestName;
        } else {
          // Send to bottom if no GPS
          g.distanceToAgent = Infinity;
        }
      });
      groups.sort((a, b) => (a.distanceToAgent ?? Infinity) - (b.distanceToAgent ?? Infinity));
    }
    return groups;
  }, [filteredRows, isSortedByNearest, agentLocation]);

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Loan-level figures for the collect popup: today's due and total outstanding
  // (overdue + today + any future) across ALL the loan's open instalments.
  const loanFiguresFor = (instalment: CollectionRow) => {
    const map = new Map<string, CollectionRow>();
    [...todayInstalments, ...overdueInstalments]
      .filter((r) => r.loan.id === instalment.loan.id)
      .forEach((r) => map.set(r.id, r));
    const rows = Array.from(map.values());
    const totalOutstanding = rows.reduce((s, r) => s + r.outstandingAmount, 0);
    const todayDue = rows
      .filter((r) => getIstDateStr(r.dueDate) === todayISO || r.dueDate.slice(0, 10) === todayISO)
      .reduce((s, r) => s + r.outstandingAmount, 0);
    return { rows, totalOutstanding, todayDue, overdue: Math.max(0, totalOutstanding - todayDue) };
  };

  const openModal = (instalment: CollectionRow) => {
    const isPaid = instalment.receivedAmount > 0;
    if (isPaid) {
      // Edit/correction path stays single-instalment (admin edits, or agent edit
      // requests) — unchanged behaviour, recorded against THIS instalment only.
      setAmount(instalment.receivedAmount);
    } else {
      // New collection: default to today's due; if nothing is due today (pure
      // overdue catch-up) default to the full outstanding. Actual keeps the
      // payment on the collection-date row; Distributed is display-only.
      const fig = loanFiguresFor(instalment);
      const defaultAmt = fig.todayDue > 0 ? fig.todayDue : fig.totalOutstanding;
      setSelectedCard(fig.todayDue > 0 ? 'today' : 'total');
      setAmount(defaultAmt);
    }
    setMode('cash');
    setRemarks('');
    setReason('');
    setGpsStatusText('');
    setModal(instalment);
  };

  const captureCurrentLocation = (): Promise<BrowserGpsCapture> => {
    if (!gpsTrackingEnabled) {
      return Promise.resolve({ status: 'not_captured' });
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatusText('Location unavailable');
      return Promise.resolve({ status: 'not_captured' });
    }

    setGpsStatusText('Capturing location...');
    return new Promise<BrowserGpsCapture>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsStatusText('Location captured');
          resolve({
            status: 'captured',
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            timestamp: new Date(position.timestamp).toISOString(),
          });
        },
        (error) => {
          const status = error.code === error.PERMISSION_DENIED ? 'location_denied' : 'gps_timeout';
          setGpsStatusText(status === 'location_denied' ? 'Location denied' : 'Location timed out');
          resolve({ status });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  };

  const handleSortByNearest = async () => {
    if (isSortedByNearest) {
      setIsSortedByNearest(false);
      setAgentLocation(null);
      return;
    }
    const gps = await captureCurrentLocation();
    if (gps.latitude && gps.longitude) {
      setAgentLocation({ latitude: gps.latitude, longitude: gps.longitude });
      setIsSortedByNearest(true);
    } else {
      alert('Could not capture location to sort.');
    }
  };

  const handleSubmit = async () => {
    if (!modal || amount < 0) return;
    setLoading(true);
    const fd = new FormData();
    fd.set('instalmentId', modal.id);

    const isEditRequest = modal.receivedAmount > 0 && !isAdmin;

    try {
      if (isEditRequest) {
        fd.set('requestedAmount', String(amount));
        fd.set('reason', reason);
        const result = await requestCollectionEdit(fd);
        setLoading(false);
        if (result.success) {
          setModal(null);
          alert('Edit request submitted successfully.');
        } else {
          alert(result.error || 'Failed to submit request');
        }
      } else {
        fd.set('paymentMode', mode);
        fd.set('remarks', remarks);
        const gps = await captureCurrentLocation();
        fd.set('gpsStatus', gps.status);
        if (gps.latitude !== undefined) fd.set('gpsLatitude', String(gps.latitude));
        if (gps.longitude !== undefined) fd.set('gpsLongitude', String(gps.longitude));
        if (gps.accuracy !== undefined) fd.set('gpsAccuracy', String(gps.accuracy));
        if (gps.altitude !== undefined && gps.altitude !== null) fd.set('gpsAltitude', String(gps.altitude));
        if (gps.timestamp) fd.set('gpsTimestamp', gps.timestamp);

        // New collection (instalment never paid) records loan-wide on the
        // collection-date row for Actual. Admin correction of an already-paid
        // instalment stays a single-instalment write.
        let result;
        if (modal.receivedAmount === 0) {
          fd.set('loanId', modal.loan.id);
          fd.set('amount', String(amount));
          result = await submitLoanCollection(fd);
        } else {
          fd.set('receivedAmount', String(amount));
          result = await submitCollectionEntry(fd);
        }
        setLoading(false);
        if (result.success) {
          setModal(null);
          router.refresh();
        } else {
          alert(result.error || 'Failed to submit');
        }
      }
    } catch (err) {
      setLoading(false);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      alert(message);
    }
  };

  const clearFilters = () => {
    setDateFilter('');
    setCustomerFilter('');
    handleRouteChange('');
    setStatusFilter('');
    setFrequencyFilter('');
    setSessionFilter('');
    setTypeFilter(initialTab);
    setOverdueMinDays('');
    setOverdueMaxDays('');
  };

  useEffect(() => {
    setPage(1);
  }, [typeFilter, customerFilter, dateFilter, routeFilter, statusFilter, frequencyFilter, sessionFilter, overdueMinDays, overdueMaxDays, viewMode]);

  const hasActiveFilters = Boolean(
    dateFilter ||
    customerFilter ||
    routeFilter ||
    statusFilter ||
    frequencyFilter ||
    sessionFilter ||
    typeFilter !== initialTab ||
    overdueMinDays ||
    overdueMaxDays
  );

  const pageSize = 20;
  const currentTotalCount = viewMode === 'instalments' ? filteredRows.length : unifiedGroups.length;
  const totalPages = Math.max(1, Math.ceil(currentTotalCount / pageSize));
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const paginatedGroups = unifiedGroups.slice((page - 1) * pageSize, page * pageSize);
  const pageButtons = getPaginationPages(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const buildOverdueGroup = (group: UnifiedGroup): CustomerOverdueGroup => {
    return {
      ...group,
      earliestDueDate: group.instalments.map(i => i.dueDate).sort()[0],
      dueToday: group.instalments.filter(i => getIstDateStr(i.dueDate) === todayISO || i.dueDate.slice(0, 10) === todayISO).reduce((s, i) => s + i.dueAmount, 0),
      receivedAmount: group.instalments.reduce((s, i) => s + i.receivedAmount, 0),
      totalOutstanding: group.instalments.reduce((s, i) => s + i.outstandingAmount, 0),
      totalOverdue: group.instalments.filter(i => i.daysOverdue > 0).reduce((s, i) => s + i.overdueAmount, 0),
      maxDaysOverdue: Math.max(0, ...group.instalments.map(i => i.daysOverdue)),
      statusLabel: 'Mixed'
    };
  };

  // Aggregate one set of instalments (a whole customer, or a single loan) into
  // the figures shown in a collection row. Reused for the parent customer row
  // and each expanded per-loan sub-row.
  const metricsFor = (insts: UnifiedGroup['instalments']) => {
    const earliestDateIso = insts.map(i => i.dueDate).sort()[0] || '';
    const dueTodayAmount = insts.filter(i => getIstDateStr(i.dueDate) === todayISO || i.dueDate.slice(0, 10) === todayISO).reduce((s, i) => s + i.dueAmount, 0);
    const receivedAmount = insts.reduce((s, i) => s + i.receivedAmount, 0);
    const uniqueLoans = Array.from(new Map(insts.map(i => [i.loan.id, i.loan])).values());
    const totalLoanPayable = uniqueLoans.reduce((s, l) => s + l.totalPayable, 0);
    const totalLoanCollected = uniqueLoans.reduce((s, l) => s + l.totalCollected, 0);
    const totalLoanOutstanding = totalLoanPayable - totalLoanCollected;
    const remainingInstalments = uniqueLoans.reduce((s, l) => s + (l.totalInstalments - l.paidCount), 0);
    const overdueInstalments = insts.filter(i => i.daysOverdue > 0 && i.outstandingAmount > 0);
    const maxDaysOverdue = overdueInstalments.length > 0 ? Math.max(...overdueInstalments.map(i => i.daysOverdue)) : 0;
    const totalOverdueAmount = overdueInstalments.reduce((s, i) => s + i.overdueAmount, 0);
    const keys = insts.map(i => deriveInstalmentStatus(i, todayISO).key);
    const displayStatus = keys.every(k => k === 'paid') ? 'Paid'
      : keys.some(k => k === 'missed') ? 'Overdue'
      : keys.some(k => k === 'partial') ? 'Partial'
      : keys.some(k => k === 'due today') ? 'Due Today'
      : 'Upcoming';
    const isSettled = insts.every(i => i.outstandingAmount <= 0);
    const unpaidInstalments = insts.filter(i => i.outstandingAmount > 0);
    return { earliestDateIso, dueTodayAmount, receivedAmount, totalLoanPayable, totalLoanCollected, totalLoanOutstanding, remainingInstalments, overdueInstalments, maxDaysOverdue, totalOverdueAmount, displayStatus, isSettled, unpaidInstalments };
  };

  // The 7 data cells (due date → action) shared by parent and sub-rows.
  const renderRowCells = (insts: UnifiedGroup['instalments'], sg: UnifiedGroup) => {
    const m = metricsFor(insts);
    return (
      <>
        <td data-label={dict.collection.dueDate}>{m.earliestDateIso ? formatDate(m.earliestDateIso) : '-'}</td>
        <td data-label={dict.collection.dueTodayLabel}>{m.dueTodayAmount > 0 ? formatCurrency(m.dueTodayAmount, currencySymbol) : '-'}</td>
        <td data-label={dict.collection.receivedLabel}>{m.receivedAmount > 0 ? formatCurrency(m.receivedAmount, currencySymbol) : '-'}</td>
        <td
          data-label={dict.collection.outstandingLabel}
          title={`Total Payable: ${formatCurrency(m.totalLoanPayable, currencySymbol)}\nTotal Paid: ${formatCurrency(m.totalLoanCollected, currencySymbol)}\nRemaining Instalments: ${m.remainingInstalments}`}
          style={{ fontWeight: 700, color: m.totalLoanOutstanding > 0 ? 'var(--danger)' : 'var(--success)', cursor: 'help' }}
        >
          {formatCurrency(m.totalLoanOutstanding, currencySymbol)}
        </td>
        <td data-label={dict.collection.overdueLabel} onClick={(e) => e.stopPropagation()}>
          {m.overdueInstalments.length > 0 ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setOverdueCustomerGroup(buildOverdueGroup(sg))} style={{ padding: '2px 6px', height: 'auto', minHeight: '26px' }}>
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{m.maxDaysOverdue}d</span>
              <span style={{ margin: '0 4px', color: 'var(--text-light)' }}>·</span>
              <span>{formatCurrency(m.totalOverdueAmount, currencySymbol)}</span>
            </button>
          ) : '-'}
        </td>
        <td data-label={dict.collection.statusLabel}>
          <span className={getBadgeClass(m.displayStatus.toLowerCase())} style={{ textTransform: 'capitalize' }}>
            {m.displayStatus}
          </span>
        </td>
        <td data-label={dict.collection.actionLabel} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {m.unpaidInstalments.length === 0 ? (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => openModal(insts[0])}>
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>{isAdmin ? 'edit' : 'history_edu'}</span> {isAdmin ? dict.collection.editLabel : dict.collection.requestLabel}
                </button>
                {receiptPdfEnabled && insts[0]?.collectionEntry?.id && (
                  <a
                    href={`/api/receipts/${insts[0].collectionEntry.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    title="Download Receipt"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>receipt_long</span>
                    {dict.collection.receiptLabel}
                  </a>
                )}
              </>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => m.unpaidInstalments.length === 1 ? openModal(m.unpaidInstalments[0]) : setOverdueCustomerGroup(buildOverdueGroup(sg))}>
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>payments</span> {dict.collection.payLabel}
              </button>
            )}
          </div>
        </td>
      </>
    );
  };

  // App-like card list for mobile (the table is hidden <=768px via CSS). Big
  // name, big due, big Pay button — scannable and thumb-friendly.
  const renderMobileCards = (groups: UnifiedGroup[]) => (
    <div className="collection-cards">
      {groups.map((group) => {
        const m = metricsFor(group.instalments);
        const settled = m.unpaidInstalments.length === 0;
        const payAmount = m.dueTodayAmount > 0 ? m.dueTodayAmount : m.totalLoanOutstanding;
        return (
          <div key={group.customerId} className="collect-card" style={{ opacity: m.isSettled ? 0.7 : 1 }}>
            <div className="collect-card-head">
              <div className="profile-avatar" style={{ width: 40, height: 40, fontSize: '.9rem', flexShrink: 0 }}>
                {getInitials(group.customerName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/customers/${group.customerCode}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 700, fontSize: '1.02rem' }}>
                  {group.customerName}
                </Link>
                <div className="collect-muted" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  {group.loanCodes.join(', ')} · {group.routeName}
                </div>
              </div>
              {group.customerPhone && (
                <a
                  href={`tel:${group.customerPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  title="Call"
                  style={{ display: 'flex', color: 'var(--success, #16a34a)', flexShrink: 0 }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '20px' }}>call</span>
                </a>
              )}
              {group.mapLat != null && group.mapLng != null && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${group.mapLat},${group.mapLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open location in Maps"
                  style={{ display: 'flex', color: 'var(--primary-dark, #b45309)', flexShrink: 0 }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '20px' }}>location_on</span>
                </a>
              )}
              <span className={getBadgeClass(m.displayStatus.toLowerCase())} style={{ textTransform: 'capitalize', flexShrink: 0 }}>
                {m.displayStatus}
              </span>
            </div>

            <div className="collect-card-figs">
              <div>
                <span className="collect-muted">{dict.collection.dueTodayLabel}</span>
                <b className="collect-big">{formatCurrency(m.dueTodayAmount, currencySymbol)}</b>
              </div>
              <div>
                <span className="collect-muted">{dict.collection.outstandingLabel}</span>
                <b style={{ fontSize: '1rem', fontWeight: 800, color: m.totalLoanOutstanding > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {formatCurrency(m.totalLoanOutstanding, currencySymbol)}
                </b>
              </div>
              {m.totalOverdueAmount > 0 && (
                <div>
                  <span className="collect-muted">{dict.collection.overdueLabel} · {m.maxDaysOverdue}d</span>
                  <b style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--danger)' }}>{formatCurrency(m.totalOverdueAmount, currencySymbol)}</b>
                </div>
              )}
            </div>

            {settled ? (
              <button className="btn btn-secondary btn-block" onClick={() => openModal(group.instalments[0])}>
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>{isAdmin ? 'edit' : 'history_edu'}</span>
                {isAdmin ? dict.collection.editLabel : dict.collection.requestLabel}
              </button>
            ) : (
              <button
                className="btn btn-primary btn-block collect-big-pay"
                onClick={() => (m.unpaidInstalments.length === 1 ? openModal(m.unpaidInstalments[0]) : setOverdueCustomerGroup(buildOverdueGroup(group)))}
              >
                <span className="material-icons-outlined" style={{ fontSize: 20 }}>payments</span>
                {dict.collection.payLabel} {formatCurrency(payAmount, currencySymbol)}
              </button>
            )}
          </div>
        );
      })}
      {groups.length === 0 && (
        <div className="collect-card" style={{ textAlign: 'center', color: 'var(--text-light)' }}>
          {dict.collection.noInstalmentsMatch}
        </div>
      )}
    </div>
  );

  const renderInstalmentRows = (rows: CollectionRow[]) => (
    <div className="table-wrapper collection-table-wrap">
      <table>
        <thead>
          <tr>
            <th>{dict.customers.title}</th>
            <th>{dict.sidebar.loans}</th>
            <th>{dict.collection.dueDate}</th>
            <th>{dict.collection.dueTodayLabel}</th>
            <th>{dict.collection.receivedLabel}</th>
            <th>{dict.collection.outstandingLabel}</th>
            <th>{dict.collection.overdueLabel}</th>
            <th>{dict.collection.statusLabel}</th>
            <th>{dict.collection.actionLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((instalment) => {
            const isSettled = instalment.outstandingAmount <= 0;
            const statusInfo = deriveInstalmentStatus(instalment, todayISO);
            const isDueToday = getIstDateStr(instalment.dueDate) === todayISO || instalment.dueDate.slice(0, 10) === todayISO;
            const fig = loanFiguresFor(instalment);
            const cust = instalment.loan.customer;

            return (
              <tr key={instalment.id} className="collection-entry" style={{ opacity: isSettled ? 0.62 : 1 }}>
                <td data-label={dict.customers.title}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="profile-avatar" style={{ width: '32px', height: '32px', fontSize: '.75rem', flexShrink: 0 }}>
                      {getInitials(cust.name)}
                    </div>
                    <div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Link href={`/customers/${cust.customerCode}`}>
                          <strong>{cust.name}</strong>
                        </Link>
                        {cust.phone && (
                          <a
                            href={`tel:${cust.phone}`}
                            title="Call"
                            style={{ display: 'flex', color: 'var(--success, #16a34a)' }}
                          >
                            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>call</span>
                          </a>
                        )}
                      </span>
                      <div style={{ fontSize: '.72rem', color: 'var(--text-light)', marginTop: '2px' }}>
                        {cust.customerCode} · {cust.route?.name || '-'}
                      </div>
                    </div>
                  </div>
                </td>
                <td data-label={dict.sidebar.loans}>
                  <Link href={`/loans/${instalment.loan.loanCode}`} style={{ fontWeight: 600 }}>
                    {instalment.loan.loanCode}
                  </Link>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>
                    #{instalment.instalmentNo} · {instalment.loan.frequency}
                  </div>
                </td>
                <td data-label={dict.collection.dueDate}>
                  {formatDate(instalment.dueDate)}
                </td>
                <td data-label={dict.collection.dueTodayLabel}>
                  {isDueToday && instalment.outstandingAmount > 0
                    ? formatCurrency(instalment.dueAmount, currencySymbol)
                    : '-'}
                </td>
                <td data-label={dict.collection.receivedLabel}>
                  {instalment.receivedAmount > 0
                    ? formatCurrency(instalment.receivedAmount, currencySymbol)
                    : '-'}
                </td>
                <td
                  data-label={dict.collection.outstandingLabel}
                  title={`Instalment Outstanding: ${formatCurrency(instalment.outstandingAmount, currencySymbol)}\nTotal Loan Outstanding: ${formatCurrency(fig.totalOutstanding, currencySymbol)}`}
                  style={{ fontWeight: 700, color: instalment.outstandingAmount > 0 ? 'var(--danger)' : 'var(--success)', cursor: 'help' }}
                >
                  {formatCurrency(instalment.outstandingAmount, currencySymbol)}
                  <span style={{ display: 'block', fontSize: '.7rem', fontWeight: 400, color: 'var(--text-light)' }}>
                    Loan: {formatCurrency(fig.totalOutstanding, currencySymbol)}
                  </span>
                </td>
                <td data-label={dict.collection.overdueLabel}>
                  {instalment.daysOverdue > 0 && instalment.outstandingAmount > 0 ? (
                    <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                      {instalment.daysOverdue}d · {formatCurrency(instalment.overdueAmount, currencySymbol)}
                    </span>
                  ) : '-'}
                </td>
                <td data-label={dict.collection.statusLabel}>
                  <span className={getBadgeClass(statusInfo.key)} style={{ textTransform: 'capitalize' }}>
                    {statusInfo.label}
                  </span>
                </td>
                <td data-label={dict.collection.actionLabel}>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {isSettled ? (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => openModal(instalment)}>
                          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>{isAdmin ? 'edit' : 'history_edu'}</span>
                          {isAdmin ? dict.collection.editLabel : dict.collection.requestLabel}
                        </button>
                        {receiptPdfEnabled && instalment.collectionEntry?.id && (
                          <a
                            href={`/api/receipts/${instalment.collectionEntry.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm"
                            title="Download Receipt"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                          >
                            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>receipt_long</span>
                            {dict.collection.receiptLabel}
                          </a>
                        )}
                      </>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => openModal(instalment)}>
                        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>payments</span>
                        {dict.collection.payLabel}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)' }}>
                {dict.collection.noInstalmentsMatch}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderUnifiedRows = (groups: UnifiedGroup[]) => (
    <div className="table-wrapper collection-table-wrap">
      <table>
        <thead>
          <tr>
            <th>{dict.customers.title}</th>
            <th>{dict.sidebar.loans}</th>
            <th>{dict.collection.dueDate}</th>
            <th>{dict.collection.dueTodayLabel}</th>
            <th>{dict.collection.receivedLabel}</th>
            <th>{dict.collection.outstandingLabel}</th>
            <th>{dict.collection.overdueLabel}</th>
            <th>{dict.collection.statusLabel}</th>
            <th>{dict.collection.actionLabel}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const canExpand = group.loanCodes.length > 1 || group.instalments.length > 1;
            const expanded = expandedCustomers.has(group.customerId);
            const pm = metricsFor(group.instalments);
            return (
              <Fragment key={group.customerId}>
                <tr
                  className="collection-entry"
                  style={{ opacity: pm.isSettled ? 0.62 : 1, cursor: canExpand ? 'pointer' : undefined }}
                  onClick={canExpand ? () => toggleCustomerExpand(group.customerId) : undefined}
                >
                  <td data-label={dict.customers.title}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {canExpand ? (
                        <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--text-light)', transition: 'transform .2s', transform: expanded ? 'rotate(90deg)' : 'none' }}>chevron_right</span>
                      ) : (
                        <span style={{ width: '20px', flexShrink: 0 }} />
                      )}
                      <div className="profile-avatar" style={{ width: '32px', height: '32px', fontSize: '.75rem', flexShrink: 0 }}>
                        {getInitials(group.customerName)}
                      </div>
                      <div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Link href={`/customers/${group.customerCode}`} onClick={(e) => e.stopPropagation()}>
                            <strong>{group.customerName}</strong>
                          </Link>
                          {group.customerPhone && (
                            <a
                              href={`tel:${group.customerPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              title="Call"
                              style={{ display: 'flex', color: 'var(--success, #16a34a)' }}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>call</span>
                            </a>
                          )}
                          {group.mapLat != null && group.mapLng != null && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${group.mapLat},${group.mapLng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Open location in Maps"
                              style={{ display: 'flex', color: 'var(--primary-dark, #b45309)' }}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>location_on</span>
                            </a>
                          )}
                        </span>
                        {group.distanceToAgent !== undefined && group.distanceToAgent !== Infinity && (
                          <div style={{ fontSize: '.75rem', color: 'var(--text-light)', marginTop: '2px' }}>
                            <span className="material-icons-outlined" style={{ fontSize: '12px', verticalAlign: 'middle', marginRight: '2px' }}>location_on</span>
                            {group.distanceToAgent < 1
                              ? `${Math.round(group.distanceToAgent * 1000)}m away`
                              : `${group.distanceToAgent.toFixed(1)}km away`}
                            {group.nearestPointName && ` (${group.nearestPointName})`}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td data-label={dict.sidebar.loans} onClick={(e) => e.stopPropagation()}>
                    {group.loanCodes.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => toggleCustomerExpand(group.customerId)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', background: 'var(--primary-light, #FFF3E0)', color: 'var(--primary-dark, #E8930C)', border: '1px solid var(--primary, #F5A623)', borderRadius: '999px' }}
                      >
                        {dict.collection.allLoans} ({group.loanCodes.length})
                        <span className="material-icons-outlined" style={{ fontSize: '16px', transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                      </button>
                    ) : group.instalments.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => toggleCustomerExpand(group.customerId)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', background: 'var(--primary-light, #FFF3E0)', color: 'var(--primary-dark, #E8930C)', border: '1px solid var(--primary, #F5A623)', borderRadius: '999px' }}
                      >
                        {group.loanCodes[0]} ({group.instalments.length})
                        <span className="material-icons-outlined" style={{ fontSize: '16px', transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                      </button>
                    ) : (
                      <Link href={`/loans/${group.loanCodes[0]}`}>{group.loanCodes[0]}</Link>
                    )}
                  </td>
                  {renderRowCells(group.instalments, group)}
                </tr>
                {canExpand && expanded && group.loanCodes.length > 1 && group.loanCodes.map((code) => {
                  const loanInsts = group.instalments.filter(i => i.loan.loanCode === code);
                  if (loanInsts.length === 0) return null;
                  const cm = metricsFor(loanInsts);
                  const subGroup: UnifiedGroup = { ...group, instalments: loanInsts, loanCodes: [code] };
                  return (
                    <tr key={`${group.customerId}__${code}`} className="collection-entry" style={{ background: 'var(--bg-light, #FAFBFC)', opacity: cm.isSettled ? 0.62 : 1 }}>
                      <td style={{ paddingLeft: '54px', color: 'var(--text-light)' }}>↳</td>
                      <td><Link href={`/loans/${code}`} style={{ fontSize: '.82rem', fontWeight: 600 }}>{code}</Link></td>
                      {renderRowCells(loanInsts, subGroup)}
                    </tr>
                  );
                })}
                {canExpand && expanded && group.loanCodes.length === 1 && group.instalments.map((inst) => {
                  const isSettled = inst.outstandingAmount <= 0;
                  const statusInfo = deriveInstalmentStatus(inst, todayISO);
                  const isDueToday = getIstDateStr(inst.dueDate) === todayISO || inst.dueDate.slice(0, 10) === todayISO;
                  return (
                    <tr key={inst.id} className="collection-entry" style={{ background: 'var(--bg-light, #FAFBFC)', opacity: isSettled ? 0.62 : 1 }}>
                      <td style={{ paddingLeft: '54px', color: 'var(--text-light)', fontSize: '.8rem' }}>
                        ↳ #{inst.instalmentNo}
                      </td>
                      <td>
                        <Link href={`/loans/${inst.loan.loanCode}`} style={{ fontSize: '.82rem', fontWeight: 600 }}>
                          {inst.loan.loanCode}
                        </Link>
                      </td>
                      <td>{formatDate(inst.dueDate)}</td>
                      <td>{isDueToday && inst.outstandingAmount > 0 ? formatCurrency(inst.dueAmount, currencySymbol) : '-'}</td>
                      <td>{inst.receivedAmount > 0 ? formatCurrency(inst.receivedAmount, currencySymbol) : '-'}</td>
                      <td style={{ fontWeight: 700, color: inst.outstandingAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {formatCurrency(inst.outstandingAmount, currencySymbol)}
                      </td>
                      <td>
                        {inst.daysOverdue > 0 && inst.outstandingAmount > 0 ? (
                          <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                            {inst.daysOverdue}d · {formatCurrency(inst.overdueAmount, currencySymbol)}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        <span className={getBadgeClass(statusInfo.key)} style={{ textTransform: 'capitalize' }}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td>
                        {isSettled ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => openModal(inst)}>
                            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>{isAdmin ? 'edit' : 'history_edu'}</span>
                            {isAdmin ? dict.collection.editLabel : dict.collection.requestLabel}
                          </button>
                        ) : (
                          <button className="btn btn-primary btn-sm" onClick={() => openModal(inst)}>
                            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>payments</span>
                            {dict.collection.payLabel}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
          {groups.length === 0 && (
            <tr>
              <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)' }}>
                {dict.collection.noInstalmentsMatch}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="card" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="profile-avatar" style={{ width: '48px', height: '48px', fontSize: '1rem' }}>{getInitials(agentName)}</div>
            <div>
              <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 700 }}>
                {agentName} - {agentRole === 'admin' ? dict.roles.admin : dict.roles.agent}
              </h3>
              <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Today: <strong>{todayStr}</strong> · {dict.collection.route}: <strong style={{ color: activeRouteObj ? 'var(--primary)' : 'inherit' }}>{activeRouteObj ? activeRouteObj.name : routeName}</strong>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href="/collection/runs" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>route</span>
              Route Runs
            </Link>
            <Link href="/collection/self-pay" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>qr_code_2</span>
              Self-Pay
            </Link>
            <span className="badge badge-active" style={{ fontSize: '.8rem', padding: '6px 14px' }}>{dict.collection.online}</span>
            {agentRole === 'agent' && dailyCollection && dailyCollection.totalCollected > 0 && dailyCollection.status === 'open' && (
              <button 
                className="btn btn-primary btn-sm" 
                onClick={async () => {
                  if (!confirm(`Submit handover of ${formatCurrency(dailyCollection.totalCollected, currencySymbol)}?`)) return;
                  setLoading(true);
                  const res = await requestCashHandover();
                  setLoading(false);
                  if (res.success) {
                    alert('Handover requested successfully');
                    router.refresh();
                  } else {
                    alert(res.error || 'Failed to submit handover');
                  }
                }}
                disabled={loading}
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>payments</span>
                {dict.collection.submitHandover}
              </button>
            )}
            {dailyCollection?.status === 'pending_handover' && (
              <span className="badge" style={{ fontSize: '.8rem', padding: '6px 14px', background: 'rgba(245,158,11,.1)', color: '#D97706' }}>
                {dict.collection.handoverPending}
              </span>
            )}
            {dailyCollection?.status === 'settled' && (
              <span className="badge" style={{ fontSize: '.8rem', padding: '6px 14px', background: 'rgba(16,185,129,.1)', color: 'var(--success)' }}>
                {dict.collection.handoverSettled}
              </span>
            )}
          </div>
        </div>

        {/* ── Prominent Route Switcher Bar ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '10px 14px',
          background: 'var(--bg-card-subtle, rgba(99,102,241,0.04))',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}>
              <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>alt_route</span>
              {dict.collection.switchRoute || 'Switch Route'}:
            </span>

            {/* Quick Switch Pills */}
            <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleRouteChange('')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: !routeFilter ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                  background: !routeFilter ? 'var(--primary)' : 'var(--card-bg, #fff)',
                  color: !routeFilter ? '#fff' : 'var(--text-secondary)',
                  fontWeight: !routeFilter ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>🌐 {dict.collection.allRoutes || 'All Routes'}</span>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: !routeFilter ? 'rgba(255,255,255,0.25)' : 'var(--bg-card-subtle, rgba(0,0,0,0.06))',
                  color: !routeFilter ? '#fff' : 'var(--text-light)',
                  fontWeight: 700,
                }}>
                  {totalDistinctCustomers}
                </span>
              </button>

              {availableRoutes.map((r) => {
                const isSelected = routeFilter === r.id || routeFilter === r.name;
                const rStats = routeStats[r.id];
                const custCount = rStats ? rStats.customerIds.size : 0;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleRouteChange(r.id)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '20px',
                      border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--primary)' : 'var(--card-bg, #fff)',
                      color: isSelected ? '#fff' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>📍 {r.name}</span>
                    {custCount > 0 && (
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--bg-card-subtle, rgba(0,0,0,0.06))',
                        color: isSelected ? '#fff' : 'var(--text-light)',
                        fontWeight: 700,
                      }}>
                        {custCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dropdown for route selection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              aria-label={dict.collection.switchRoute || 'Switch Route'}
              value={routeFilter}
              onChange={(e) => handleRouteChange(e.target.value)}
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--card-bg, #fff)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                outline: 'none',
                minWidth: '150px',
              }}
            >
              <option value="">🌐 {dict.collection.allRoutes || 'All Routes'} ({totalDistinctCustomers})</option>
              {availableRoutes.map((r) => {
                const rStats = routeStats[r.id];
                const custCount = rStats ? rStats.customerIds.size : 0;
                return (
                  <option key={r.id} value={r.id}>
                    📍 {r.name} {custCount > 0 ? `(${custCount} customers)` : ''}
                  </option>
                );
              })}
            </select>

            {routeFilter && (
              <button
                type="button"
                onClick={() => handleRouteChange('')}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.75rem', padding: '4px 8px', color: 'var(--text-secondary)' }}
                title="Reset to All Routes"
              >
                ✕ {dict.penalties?.clear || 'Clear'}
              </button>
            )}
          </div>
        </div>
      </div>

      {(() => {
        const todayPct = pct(todayTotals.collected, todayTotals.due);
        const overduePct = pct(overdueTotals.recovered, overdueTotals.dueTotal);
        const custPct = pct(customerProgress.done, customerProgress.total);
        const ProgressCard = ({
          icon, tone, title, badge, big, bigColor, barPct, sub,
        }: {
          icon: string; tone: string; title: string; badge?: string;
          big: string; bigColor: string; barPct: number; sub: string;
        }) => (
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: `${tone}1f`, color: tone, flexShrink: 0 }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>{icon}</span>
              </div>
              <span style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</span>
              {badge && <span style={{ marginLeft: 'auto', fontSize: '.7rem', fontWeight: 700, color: tone, background: `${tone}1f`, padding: '2px 8px', borderRadius: 999 }}>{badge}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: bigColor }}>{big}</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: tone }}>{barPct}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${barPct}%`, height: '100%', background: tone, borderRadius: 6, transition: 'width .4s ease' }} />
            </div>
            <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{sub}</span>
          </div>
        );
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <ProgressCard
              icon="today" tone="#10B981" title={dict.collection.todayDue}
              big={`${formatCurrency(todayTotals.collected, currencySymbol)} / ${formatCurrency(todayTotals.due, currencySymbol)}`}
              bigColor="var(--text)" barPct={todayPct}
              sub={`${dict.collection.collectedToday} · ${formatCurrency(todayTotals.outstanding, currencySymbol)} left`}
            />
            <ProgressCard
              icon="warning_amber" tone="#EF4444" title={dict.collection.overdueLabel}
              badge={`${overdueTotals.count} · ${overdueTotals.maxDays}d`}
              big={`${formatCurrency(overdueTotals.recovered, currencySymbol)} / ${formatCurrency(overdueTotals.dueTotal, currencySymbol)}`}
              bigColor="var(--text)" barPct={overduePct}
              sub={`${formatCurrency(overdueTotals.amount, currencySymbol)} ${dict.collection.overdueLabel.toLowerCase()} pending`}
            />
            <ProgressCard
              icon="groups" tone="#6366F1" title={dict.customers.title}
              badge={`${customerProgress.done}/${customerProgress.total}`}
              big={`${customerProgress.done} / ${customerProgress.total}`}
              bigColor="var(--text)" barPct={custPct}
              sub={`${customerProgress.done} ${dict.collection.collectedToday.toLowerCase()} · ${customerProgress.total - customerProgress.done} left`}
            />
          </div>
        );
      })()}

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '1rem', margin: 0 }}>
            {dict.collection.collections}
            <span style={{ fontSize: '.8rem', fontWeight: 400, color: 'var(--text-light)', marginLeft: '8px' }}>
              {viewMode === 'instalments'
                ? `${filteredRows.length} ${dict.accounting.of} ${allInstalments.length} ${dict.collection.instalments}`
                : `${unifiedGroups.length} ${dict.customers.title.toLowerCase()} (${filteredRows.length} ${dict.collection.instalments})`}
            </span>
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'instalments' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 0, padding: '4px 10px', fontSize: '.8rem' }}
                onClick={() => setViewMode('instalments')}
                title="View individual instalments"
              >
                <span className="material-icons-outlined" style={{ fontSize: '15px' }}>view_list</span>
                {dict.collection.instalments || 'Instalments'} ({filteredRows.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'grouped' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 0, padding: '4px 10px', fontSize: '.8rem' }}
                onClick={() => setViewMode('grouped')}
                title="Group summary by customer"
              >
                <span className="material-icons-outlined" style={{ fontSize: '15px' }}>groups</span>
                {dict.customers.title || 'Customers'} ({unifiedGroups.length})
              </button>
            </div>

            {gpsTrackingEnabled && (
              <button type="button" className={`btn btn-sm ${isSortedByNearest ? 'btn-primary' : 'btn-ghost'}`} onClick={handleSortByNearest}>
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>my_location</span>
                {isSortedByNearest ? dict.collection.sortedByNearest : dict.collection.sortByNearest}
              </button>
            )}
            {hasActiveFilters && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ color: 'var(--danger)' }}>
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>filter_list_off</span>
                {dict.collection.clearAllFilters}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', alignItems: 'end', marginBottom: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{dict.collection.typeLabel}</label>
            <select className="form-control" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | 'today' | 'overdue')}>
              <option value="all">{dict.collection.all} ({allInstalments.length})</option>
              <option value="today">{dict.collection.today} ({todayInstalments.length})</option>
              <option value="overdue">{dict.collection.overdueLabel} ({overdueInstalments.length})</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{dict.collection.dueDate}</label>
            <input
              type="date"
              className="form-control"
              value={dateFilter}
              onChange={(event) => {
                const val = event.target.value;
                setDateFilter(val);
                if (val && val !== todayISO && typeFilter === 'today') {
                  setTypeFilter('all');
                }
              }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{dict.collection.customerLoan}</label>
            <input className="form-control" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} placeholder={dict.collection.searchPlaceholder} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{dict.collection.routeLine}</label>
            <select className="form-control" value={routeFilter} onChange={(event) => handleRouteChange(event.target.value)}>
              <option value="">{dict.collection.allRoutes} ({totalDistinctCustomers})</option>
              {availableRoutes.map((route) => {
                const rStats = routeStats[route.id];
                const custCount = rStats ? rStats.customerIds.size : 0;
                return (
                  <option key={route.id} value={route.id}>
                    {route.name} {custCount > 0 ? `(${custCount})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{dict.collection.statusLabel}</label>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(event) => {
                const val = event.target.value;
                setStatusFilter(val);
                if (val === 'missed' && typeFilter === 'today') {
                  setTypeFilter('overdue');
                } else if (val === 'due today' && typeFilter === 'overdue') {
                  setTypeFilter('today');
                } else if (val === 'upcoming' && typeFilter !== 'all') {
                  setTypeFilter('all');
                }
              }}
            >
              <option value="">{dict.collection.all}</option>
              <option value="due today">{dict.collection.dueTodayLabel}</option>
              <option value="missed">{dict.collection.overdueLabel} / {dict.collection.missed}</option>
              <option value="partial">{dict.collection.partial}</option>
              <option value="paid">{dict.collection.paid}</option>
              <option value="upcoming">{dict.collection.upcoming}</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{dict.collection.frequency}</label>
            <select className="form-control" value={frequencyFilter} onChange={(event) => setFrequencyFilter(event.target.value)}>
              <option value="">{dict.collection.allTypes}</option>
              <option value="daily">{dict.collection.dailyLoan}</option>
              <option value="weekly">{dict.collection.weeklyLoan}</option>
              <option value="biweekly">{dict.collection.biweeklyLoan}</option>
              <option value="monthly">{dict.collection.monthlyLoan}</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Session</label>
            <select className="form-control" value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)}>
              <option value="">All sessions</option>
              <option value="anytime">Anytime</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
              <option value="night">Night</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{dict.collection.overdueMinDays}</label>
            <input
              type="number"
              className="form-control"
              value={overdueMinDays}
              onChange={(event) => {
                const val = event.target.value;
                setOverdueMinDays(val);
                if (val !== '' && Number(val) > 0 && typeFilter === 'today') {
                  setTypeFilter('overdue');
                }
              }}
              placeholder="0"
              min={0}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{dict.collection.overdueMaxDays}</label>
            <input type="number" className="form-control" value={overdueMaxDays} onChange={(event) => setOverdueMaxDays(event.target.value)} placeholder="∞" min={0} />
          </div>
        </div>

        {viewMode === 'instalments' ? renderInstalmentRows(paginatedRows) : renderUnifiedRows(paginatedGroups)}
        {renderMobileCards(paginatedGroups)}

        {totalPages > 1 && (
          <div className="pagination" style={{ justifyContent: 'center', marginTop: '12px' }}>
            <div className="pages">
              <button
                className={`page-btn ${page === 1 ? 'disabled' : ''}`}
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                &lsaquo;
              </button>
              {pageButtons.map((pageItem, index) => (
                pageItem === 'ellipsis' ? (
                  <span key={`ellipsis-${index}`} className="page-btn dots">…</span>
                ) : (
                  <button
                    key={pageItem}
                    className={`page-btn ${pageItem === page ? 'active' : ''}`}
                    onClick={() => setPage(pageItem)}
                    disabled={pageItem === page}
                  >
                    {pageItem}
                  </button>
                )
              ))}
              <button
                className={`page-btn ${page === totalPages ? 'disabled' : ''}`}
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                &rsaquo;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Overdue Customer Detail Popup ─────────────────── */}
      {overdueCustomerGroup && (
        <div
          className="modal-overlay show"
          onClick={(e) => { if (e.target === e.currentTarget) setOverdueCustomerGroup(null); }}
        >
          <div className="modal" ref={modalRef} style={{ maxWidth: '620px', width: '95vw' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="profile-avatar" style={{ width: '36px', height: '36px', fontSize: '.8rem', flexShrink: 0 }}>
                  {getInitials(overdueCustomerGroup.customerName)}
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', margin: 0 }}>
                    <Link
                      href={`/customers/${overdueCustomerGroup.customerCode}`}
                      onClick={() => setOverdueCustomerGroup(null)}
                    >
                      {overdueCustomerGroup.customerName}
                    </Link>
                  </h3>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>
                    {overdueCustomerGroup.customerCode} · {overdueCustomerGroup.routeName}
                  </div>
                </div>
              </div>
              <button className="modal-close material-icons-outlined" onClick={() => setOverdueCustomerGroup(null)}>close</button>
            </div>

            <div className="modal-body" style={{ padding: '0', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Summary row */}
              <div style={{
                display: 'flex',
                gap: '0',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg)',
              }}>
                {[
                  // Count only instalments that are genuinely overdue (past their due
                  // date AND still unpaid). Today's instalment is excluded — today
                  // isn't finished, so it isn't overdue yet.
                  { label: dict.collection.overdueInstalmentsLabel, value: String(overdueCustomerGroup.instalments.filter(i => i.daysOverdue > 0 && i.outstandingAmount > 0).length) },
                  { label: dict.collection.oldestDueModal, value: `${overdueCustomerGroup.maxDaysOverdue}d` },
                  { label: dict.collection.totalOutstanding, value: formatCurrency(overdueCustomerGroup.totalOutstanding, currencySymbol), danger: true },
                ].map(({ label, value, danger }) => (
                  <div key={label} style={{ flex: 1, padding: '12px 16px', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '.72rem', color: 'var(--text-light)', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: '.95rem', color: danger ? 'var(--danger)' : 'var(--text)' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Per-instalment list */}
              <div style={{ padding: '8px 0' }}>
                {overdueCustomerGroup.instalments.map((inst, idx) => {
                  return (
                    <div
                      key={inst.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 16px',
                        borderBottom: idx < overdueCustomerGroup.instalments.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      {/* Instalment number */}
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '.7rem',
                        fontWeight: 700,
                        flexShrink: 0,
                        color: 'var(--text-secondary)',
                      }}>
                        #{inst.instalmentNo}
                      </div>

                      {/* Date + loan */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '.85rem', fontWeight: 600 }}>{formatDate(inst.dueDate)}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-light)', marginTop: '1px' }}>
                          <Link href={`/loans/${inst.loan.loanCode}`} style={{ color: 'var(--primary)' }} onClick={() => setOverdueCustomerGroup(null)}>
                            {inst.loan.loanCode}
                          </Link>
                          {' · '}
                          {(() => {
                            const s = deriveInstalmentStatus(inst, todayISO);
                            return (
                              <span className={getBadgeClass(s.key)} style={{ textTransform: 'capitalize', fontSize: '.68rem', padding: '1px 6px' }}>
                                {s.label}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Due / outstanding */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '.82rem', color: 'var(--text-secondary)' }}>Due: {formatCurrency(inst.dueAmount, currencySymbol)}</div>
                        <div style={{ fontSize: '.82rem', fontWeight: 700, color: inst.outstandingAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          {formatCurrency(inst.outstandingAmount, currencySymbol)}
                        </div>
                      </div>

                      {/* Days overdue — read-only mapped day, no per-row Pay
                          (settle the whole loan via the footer button instead). */}
                      {inst.daysOverdue > 0 && (
                        <span style={{
                          flexShrink: 0,
                          fontSize: '.7rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '12px',
                          background: 'rgba(239,68,68,.1)',
                          color: 'var(--danger)',
                          whiteSpace: 'nowrap',
                        }}>
                          {inst.daysOverdue}d
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
              {(() => {
                // One Collect button per distinct loan with something unpaid. Each
                // opens the loan-wide collect popup.
                const loanMap = new Map<string, { code: string; inst: CollectionRow; outstanding: number }>();
                for (const inst of overdueCustomerGroup.instalments) {
                  if (inst.outstandingAmount <= 0) continue;
                  const key = inst.loan.id;
                  if (!loanMap.has(key)) {
                    loanMap.set(key, { code: inst.loan.loanCode, inst, outstanding: 0 });
                  }
                  loanMap.get(key)!.outstanding += inst.outstandingAmount;
                }
                const loans = Array.from(loanMap.values());
                const multi = loans.length > 1;
                return loans.map((l) => (
                  <button
                    key={l.code}
                    className="btn btn-primary"
                    onClick={() => { setOverdueCustomerGroup(null); openModal(l.inst); }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>payments</span>
                    {dict.collection.payLabel}{multi ? ` ${l.code}` : ''} · {formatCurrency(l.outstanding, currencySymbol)}
                  </button>
                ));
              })()}
              <button className="btn btn-secondary" onClick={() => setOverdueCustomerGroup(null)}>{dict.collection.closeLabel}</button>
            </div>
          </div>
        </div>
      )}

      {modal && (() => {
        const uniqueRowsMap = new Map();
        [...todayInstalments, ...overdueInstalments]
          .filter(r => r.loan.id === modal.loan.id)
          .forEach(r => uniqueRowsMap.set(r.id, r));
        const uniqueRows = Array.from(uniqueRowsMap.values());
        const totalLoanOutstanding = uniqueRows.reduce((sum, r) => sum + r.outstandingAmount, 0);
        const dueTodayForLoan = uniqueRows
          .filter((r) => r.dueDate.slice(0, 10) === todayISO)
          .reduce((sum, r) => sum + r.outstandingAmount, 0);
        const overdueForLoan = Math.max(0, totalLoanOutstanding - dueTodayForLoan);
        const isNewCollect = modal.receivedAmount === 0;

        return (
        <div className="modal-overlay show" onClick={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <div className="modal" ref={modalRef}>
            <div className="modal-header">
              <h3>{modal.receivedAmount > 0 ? (isAdmin ? dict.collection.editCollection : dict.collection.requestEdit) : dict.collection.title}</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setModal(null)}>close</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem' }}>
                  <span><strong>{modal.loan.customer.name}</strong></span>
                  <span style={{ color: 'var(--text-secondary)' }}>{modal.loan.customer.customerCode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  <span>{dict.collection.loanPrefix}: {modal.loan.loanCode} · #{modal.instalmentNo}</span>
                  <span>{modal.receivedAmount > 0 ? dict.collection.previouslyPaid : dict.collection.outstanding}: <strong style={{ color: 'var(--text)' }}>{formatCurrency(modal.receivedAmount > 0 ? modal.receivedAmount : modal.outstandingAmount, currencySymbol)}</strong></span>
                </div>
              </div>
              
              {isNewCollect && (
                <>
                  {/* Two preset amount cards. Pick one to fill the amount, then
                      edit freely. Actual stores it on the collection-date row. */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={() => { setSelectedCard('today'); setAmount(dueTodayForLoan); }}
                      style={{
                        flex: 1, textAlign: 'left', cursor: 'pointer',
                        background: selectedCard === 'today' ? 'rgba(245,158,11,0.08)' : 'var(--bg)',
                        border: `2px solid ${selectedCard === 'today' ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontSize: '.72rem', fontWeight: 600, color: selectedCard === 'today' ? 'var(--primary)' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        {dict.collection.todayDue}
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '4px', color: 'var(--text)' }}>
                        {formatCurrency(dueTodayForLoan, currencySymbol)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedCard('total'); setAmount(totalLoanOutstanding); }}
                      style={{
                        flex: 1, textAlign: 'left', cursor: 'pointer',
                        background: selectedCard === 'total' ? 'rgba(239,68,68,0.08)' : 'var(--bg)',
                        border: `2px solid ${selectedCard === 'total' ? 'var(--danger)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontSize: '.72rem', fontWeight: 600, color: selectedCard === 'total' ? 'var(--danger)' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        {dict.collection.totalDue}
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '4px', color: 'var(--text)' }}>
                        {formatCurrency(totalLoanOutstanding, currencySymbol)}
                      </div>
                      {overdueForLoan > 0 && (
                        <div style={{ fontSize: '.66rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {dict.collection.includesPreviousOverdue}
                        </div>
                      )}
                    </button>
                  </div>
                  <div style={{ textAlign: 'right', marginBottom: '14px' }}>
                    <Link href={`/loans/${modal.loan.loanCode}`} style={{ fontSize: '.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                      {dict.collection.outstandingDetails} →
                    </Link>
                  </div>
                </>
              )}

              {modal.receivedAmount > 0 && !isAdmin ? (
                <div className="form-group">
                  <label className="form-label">{dict.collection.correctAmount} ({currencySymbol}) *</label>
                  <input type="number" className="form-control" value={amount} onChange={(event) => setAmount(Number(event.target.value))} min={0} required />
                  <div style={{ marginTop: '12px' }}>
                    <label className="form-label">{dict.collection.reasonForChange} *</label>
                    <textarea className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={dict.collection.explainChange} required rows={3} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">{modal.receivedAmount > 0 ? dict.collection.correctedTotal : dict.collection.collected} ({currencySymbol}) *</label>
                    <input type="number" className="form-control" value={amount} onChange={(event) => setAmount(Number(event.target.value))} min={0} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{dict.collection.paymentMode}</label>
                    <select className="form-control" value={mode} onChange={(event) => setMode(event.target.value)}>
                      <option value="cash">{dict.collection.cashMode}</option>
                      <option value="upi">{dict.collection.upiMode}</option>
                      <option value="cheque">{dict.collection.chequeMode}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{dict.collection.remarksLabel}</label>
                    <input type="text" className="form-control" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder={dict.collection.optionalNote} />
                  </div>
                  {gpsTrackingEnabled && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '.78rem',
                      color: 'var(--text-secondary)',
                      marginTop: '-4px',
                    }}>
                      <span className="material-icons-outlined" style={{ fontSize: '15px' }}>my_location</span>
                      <span>{gpsStatusText || dict.collection.locationStamped}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>{dict.loans.cancel}</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || amount < 0 || (modal.receivedAmount > 0 && !isAdmin && !reason.trim())}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check</span>
                {loading ? (modal.receivedAmount > 0 && !isAdmin ? dict.collection.sending : dict.collection.receiving) : (modal.receivedAmount > 0 ? (isAdmin ? dict.collection.updatePayment : dict.collection.sendRequest) : dict.collection.submitPayment)}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </>
  );
}
