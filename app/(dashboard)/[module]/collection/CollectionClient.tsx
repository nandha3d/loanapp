'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency, formatDate, getBadgeClass, getInitials, getPaginationPages } from '@/lib/utils';
import { submitCollectionEntry, submitLoanCollection, requestCollectionEdit, requestCashHandover } from './actions';
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

// Single source of truth for an instalment's *displayed* status. The DB `status`
// column lags reality — an instalment stays 'upcoming' until a nightly batch job
// flips it to 'missed' — so we derive from money + due date instead. Crucially, an
// instalment due TODAY is "Due Today" (today isn't over yet) and is NEVER counted
// as overdue/missed.
function deriveInstalmentStatus(
  inst: { dueDate: string; receivedAmount: number; outstandingAmount: number; daysOverdue: number },
  todayISO: string,
): { key: string; label: string } {
  if (inst.outstandingAmount <= 0 && inst.receivedAmount > 0) return { key: 'paid', label: 'Paid' };
  if (inst.receivedAmount > 0) return { key: 'partial', label: 'Partial' };
  if (inst.daysOverdue > 0) return { key: 'missed', label: 'Missed' };
  if (inst.dueDate.slice(0, 10) > todayISO) return { key: 'upcoming', label: 'Upcoming' };
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
  const [routeFilter, setRouteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'today' | 'overdue'>(
    () => {
      const tab = searchParams.get('tab');
      if (tab === 'overdue') return 'overdue';
      if (tab === 'all') return 'all';
      // Default to today's worklist — the agent's day-to-day view.
      return 'today';
    },
  );
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [overdueMinDays, setOverdueMinDays] = useState('');
  const [overdueMaxDays, setOverdueMaxDays] = useState('');
  const [selectedLoanForCustomer, setSelectedLoanForCustomer] = useState<Record<string, string>>({});
  // Which customer rows are expanded to reveal their per-loan sub-rows.
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
  const todayISO = new Date().toISOString().slice(0, 10);

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

  const filteredRows = useMemo(() => {
    return allInstalments.filter((row) => {
      // Type filter
      if (typeFilter === 'today' && row.source !== 'today') return false;
      if (typeFilter === 'overdue' && row.source !== 'overdue') return false;

      const dueDate = new Date(row.dueDate).toISOString().slice(0, 10);
      const matchesDate = !dateFilter || dueDate === dateFilter;
      const search = customerFilter.trim().toLowerCase();
      const matchesCustomer = !search
        || row.loan.customer.name.toLowerCase().includes(search)
        || row.loan.customer.customerCode.toLowerCase().includes(search)
        || row.loan.loanCode.toLowerCase().includes(search);
      const matchesRoute = !routeFilter || row.loan.customer.route?.id === routeFilter;
      const matchesStatus = !statusFilter || deriveInstalmentStatus(row, todayISO).key === statusFilter;
      const matchesFrequency = !frequencyFilter || row.loan.frequency === frequencyFilter;
      const preferredSession = (row.loan.customer.preferredCollectionTime || '').toLowerCase();
      const knownSessions = ['morning', 'afternoon', 'evening', 'night'];
      const matchesSession = !sessionFilter
        || (sessionFilter === 'anytime' && !preferredSession)
        || (sessionFilter === 'other' && !!preferredSession && !knownSessions.includes(preferredSession))
        || preferredSession === sessionFilter;

      // Overdue days range filter
      const minD = overdueMinDays ? Number(overdueMinDays) : 0;
      const maxD = overdueMaxDays ? Number(overdueMaxDays) : Infinity;
      const matchesOverdueDays = row.daysOverdue >= minD && row.daysOverdue <= maxD;

      return matchesDate && matchesCustomer && matchesRoute && matchesStatus && matchesFrequency && matchesSession && matchesOverdueDays;
    });
  }, [allInstalments, typeFilter, customerFilter, dateFilter, routeFilter, statusFilter, frequencyFilter, sessionFilter, overdueMinDays, overdueMaxDays, todayISO]);

  const todayTotals = useMemo(() => {
    return {
      due: todayInstalments.reduce((sum, row) => sum + row.dueAmount, 0),
      collected: todayInstalments.reduce((sum, row) => sum + Math.min(row.receivedAmount, row.dueAmount), 0),
      outstanding: todayInstalments.reduce((sum, row) => sum + row.outstandingAmount, 0),
    };
  }, [todayInstalments]);

  const overdueTotals = useMemo(() => {
    // dueTotal = the full scheduled amount on overdue instalments; recovered =
    // what's already been paid against them; amount = still outstanding.
    const dueTotal = overdueInstalments.reduce((sum, row) => sum + row.dueAmount, 0);
    const recovered = overdueInstalments.reduce((sum, row) => sum + Math.min(row.receivedAmount, row.dueAmount), 0);
    return {
      amount: overdueInstalments.reduce((sum, row) => sum + row.overdueAmount, 0),
      dueTotal,
      recovered,
      count: overdueInstalments.length,
      maxDays: overdueInstalments.reduce((max, row) => Math.max(max, row.daysOverdue), 0),
    };
  }, [overdueInstalments]);

  // Customer worklist progress for today: how many distinct customers due today
  // have had something collected. Drives the "Customers" completion bar.
  const customerProgress = useMemo(() => {
    const dueSet = new Set<string>();
    const doneSet = new Set<string>();
    for (const row of todayInstalments) {
      const cid = row.loan.customer.id;
      dueSet.add(cid);
      if (row.receivedAmount > 0) doneSet.add(cid);
    }
    return { total: dueSet.size, done: doneSet.size };
  }, [todayInstalments]);

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
      .filter((r) => r.dueDate.slice(0, 10) === todayISO)
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
      // overdue catch-up) default to the full outstanding. Recorded loan-wide,
      // distributed oldest-first by the server.
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

        // New collection (instalment never paid) → record loan-wide, spread
        // oldest-first. Admin correction of an already-paid instalment stays a
        // single-instalment write.
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
    setRouteFilter('');
    setStatusFilter('');
    setFrequencyFilter('');
    setSessionFilter('');
    setTypeFilter('all');
    setOverdueMinDays('');
    setOverdueMaxDays('');
  };

  useEffect(() => {
    setPage(1);
  }, [typeFilter, customerFilter, dateFilter, routeFilter, statusFilter, frequencyFilter, sessionFilter, overdueMinDays, overdueMaxDays]);

  const hasActiveFilters = dateFilter || customerFilter || routeFilter || statusFilter || frequencyFilter || sessionFilter || typeFilter !== 'all' || overdueMinDays || overdueMaxDays;

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(unifiedGroups.length / pageSize));
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
      dueToday: group.instalments.filter(i => i.dueDate.slice(0, 10) === todayISO).reduce((s, i) => s + i.dueAmount, 0),
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
    const dueTodayAmount = insts.filter(i => i.dueDate.slice(0, 10) === todayISO).reduce((s, i) => s + i.dueAmount, 0);
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
            const multi = group.loanCodes.length > 1;
            const expanded = expandedCustomers.has(group.customerId);
            const pm = metricsFor(group.instalments);
            return (
              <Fragment key={group.customerId}>
                <tr
                  className="collection-entry"
                  style={{ opacity: pm.isSettled ? 0.62 : 1, cursor: multi ? 'pointer' : undefined }}
                  onClick={multi ? () => toggleCustomerExpand(group.customerId) : undefined}
                >
                  <td data-label={dict.customers.title}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {multi ? (
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
                    {multi ? (
                      <button
                        type="button"
                        onClick={() => toggleCustomerExpand(group.customerId)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', background: 'var(--primary-light, #FFF3E0)', color: 'var(--primary-dark, #E8930C)', border: '1px solid var(--primary, #F5A623)', borderRadius: '999px' }}
                      >
                        {dict.collection.allLoans} ({group.loanCodes.length})
                        <span className="material-icons-outlined" style={{ fontSize: '16px', transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                      </button>
                    ) : (
                      <Link href={`/loans/${group.loanCodes[0]}`}>{group.loanCodes[0]}</Link>
                    )}
                  </td>
                  {renderRowCells(group.instalments, group)}
                </tr>
                {multi && expanded && group.loanCodes.map((code) => {
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
      <div className="card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="profile-avatar" style={{ width: '48px', height: '48px', fontSize: '1rem' }}>{getInitials(agentName)}</div>
          <div>
            <h3 style={{ fontSize: '1rem' }}>{agentName} - {agentRole === 'admin' ? dict.roles.admin : dict.roles.agent}</h3>
            <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>
              {dict.collection.route}: <strong>{routeName}</strong> · Today: {todayStr}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
              {filteredRows.length} {dict.accounting.of} {allInstalments.length} {dict.collection.instalments}
            </span>
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
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
            <input type="date" className="form-control" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{dict.collection.customerLoan}</label>
            <input className="form-control" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} placeholder={dict.collection.searchPlaceholder} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{dict.collection.routeLine}</label>
            <select className="form-control" value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)}>
              <option value="">{dict.collection.allRoutes}</option>
              {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{dict.collection.statusLabel}</label>
            <select className="form-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
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
            <input type="number" className="form-control" value={overdueMinDays} onChange={(event) => setOverdueMinDays(event.target.value)} placeholder="0" min={0} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{dict.collection.overdueMaxDays}</label>
            <input type="number" className="form-control" value={overdueMaxDays} onChange={(event) => setOverdueMaxDays(event.target.value)} placeholder="∞" min={0} />
          </div>
        </div>

        {renderUnifiedRows(paginatedGroups)}
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
                // opens the loan-wide collect popup (oldest-first distribution).
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
                      edit freely. Payment is spread oldest-first server-side. */}
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
