'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/accounting/premium',               label: 'Overview',      icon: 'grid_view' },
  { href: '/accounting/premium/journal',       label: 'Journal',       icon: 'edit_note' },
  { href: '/accounting/premium/coa',           label: 'Accounts',      icon: 'account_tree' },
  { href: '/accounting/premium/pnl',           label: 'P&L',           icon: 'trending_up' },
  { href: '/accounting/premium/balance-sheet', label: 'Balance Sheet', icon: 'balance' },
  { href: '/accounting/premium/cashflow',      label: 'Cash Flow',     icon: 'waterfall_chart' },
  { href: '/accounting/premium/trial-balance', label: 'Trial Balance', icon: 'list_alt' },
  { href: '/accounting/premium/tax',           label: 'Tax & GST',     icon: 'receipt_long' },
  { href: '/accounting/premium/budget',        label: 'Budget',        icon: 'savings' },
  { href: '/accounting/premium/bank-rec',      label: 'Bank Rec',      icon: 'account_balance' },
  { href: '/accounting/premium/vendors',       label: 'Vendors',       icon: 'store' },
  { href: '/accounting/premium/approvals',     label: 'Approvals',     icon: 'task_alt' },
  { href: '/accounting/premium/period-lock',   label: 'Periods',       icon: 'lock_clock' },
  { href: '/accounting/premium/export',        label: 'Export',        icon: 'ios_share' },
  { href: '/accounting/premium/settings',      label: 'Settings',      icon: 'tune' },
];

export default function PremiumNav({ module }: { module: string }) {
  const pathname = usePathname();

  return (
    <>
      <style>{`
        .pa-nav{display:flex;align-items:stretch;overflow-x:auto;padding:0;scrollbar-width:none;}
        .pa-nav::-webkit-scrollbar{display:none;}
        .pa-link{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;flex:1 1 0;padding:10px 6px 9px;font-size:0.72rem;font-weight:500;color:var(--text-secondary);text-decoration:none;border-radius:0;transition:all 0.15s;white-space:nowrap;text-align:center;position:relative;min-width:62px;}
        .pa-link .pa-icon{font-size:22px;transition:transform 0.15s;}
        .pa-link::after{content:'';position:absolute;bottom:0;left:12%;right:12%;height:2px;border-radius:2px 2px 0 0;background:transparent;transition:background 0.15s;}
        .pa-link:hover{background:rgba(99,102,241,0.06);color:var(--primary);}
        .pa-link.pa-active{color:var(--primary);font-weight:700;background:rgba(99,102,241,0.08);}
        .pa-link.pa-active::after{background:var(--primary);}
        .pa-link.pa-active .pa-icon{transform:scale(1.1);}
        @media(max-width:900px){.pa-link{min-width:54px;font-size:0.68rem;} .pa-link .pa-icon{font-size:20px;}}
        @media(max-width:640px){.pa-link{min-width:50px;padding:8px 4px 7px;font-size:0.62rem;} .pa-link .pa-icon{font-size:18px;}}
      `}</style>
      <nav className="pa-nav">
        {NAV_ITEMS.map(item => {
          const href = `/${module}${item.href}`;
          const exact = item.href === '/accounting/premium';
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={item.href} href={href} className={`pa-link${isActive ? ' pa-active' : ''}`} prefetch={false}>
              <span className="material-icons-outlined pa-icon">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
