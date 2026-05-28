'use client';
/**
 * Accounting UI Design System
 * All reusable components for premium accounting pages.
 * Import from '@/app/(dashboard)/[module]/accounting/premium/ui'
 */
import React, { useEffect, useId, useRef } from 'react';

// ─── Design tokens ────────────────────────────────────────────────────────────
export const AC = {
  colors: {
    primary:   '#6366f1',
    success:   '#10b981',
    warning:   '#f59e0b',
    danger:    '#ef4444',
    info:      '#3b82f6',
    purple:    '#8b5cf6',
    gray:      '#6b7280',
  },
  radius: { sm: 6, md: 10, lg: 14, pill: 999 },
  shadow: {
    sm:  '0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04)',
    md:  '0 4px 12px rgba(0,0,0,0.08)',
    lg:  '0 8px 30px rgba(0,0,0,0.12)',
    modal:'0 20px 60px rgba(0,0,0,0.18)',
  },
} as const;

// ─── Global styles injected once ──────────────────────────────────────────────
const GLOBAL_CSS = `
  .ac-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 15px;border-radius:8px;font-size:0.84rem;font-weight:600;cursor:pointer;border:none;transition:all .15s;white-space:nowrap;text-decoration:none;line-height:1.4;}
  .ac-btn:disabled{opacity:0.55;cursor:not-allowed;}
  .ac-btn-primary{background:${AC.colors.primary};color:#fff;}
  .ac-btn-primary:hover:not(:disabled){background:#4f46e5;box-shadow:0 4px 12px rgba(99,102,241,0.35);}
  .ac-btn-success{background:${AC.colors.success};color:#fff;}
  .ac-btn-success:hover:not(:disabled){background:#059669;box-shadow:0 4px 12px rgba(16,185,129,0.35);}
  .ac-btn-danger{background:${AC.colors.danger};color:#fff;}
  .ac-btn-danger:hover:not(:disabled){background:#dc2626;box-shadow:0 4px 12px rgba(239,68,68,0.3);}
  .ac-btn-ghost{background:transparent;color:var(--text-primary);border:1.5px solid var(--border,#e5e7eb);}
  .ac-btn-ghost:hover:not(:disabled){background:rgba(99,102,241,0.05);border-color:${AC.colors.primary};color:${AC.colors.primary};}
  .ac-btn-link{background:transparent;color:${AC.colors.primary};padding:0;border-radius:4px;}
  .ac-btn-link:hover:not(:disabled){text-decoration:underline;}
  .ac-btn-sm{padding:5px 11px;font-size:0.78rem;border-radius:6px;}
  .ac-btn-icon{padding:7px;border-radius:8px;}

  .ac-card{background:var(--card-bg,#fff);border:1px solid var(--border,#e8eaed);border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,0.05);}
  .ac-card-p{padding:1.25rem 1.4rem;}

  .ac-input{width:100%;padding:8px 12px;border-radius:8px;border:1.5px solid var(--border,#e5e7eb);background:var(--card-bg,#fff);color:var(--text-primary);font-size:0.87rem;transition:border .15s,box-shadow .15s;outline:none;}
  .ac-input:focus{border-color:${AC.colors.primary};box-shadow:0 0 0 3px rgba(99,102,241,0.1);}
  .ac-input::placeholder{color:var(--text-secondary,#9ca3af);}
  .ac-textarea{resize:vertical;min-height:72px;}
  .ac-select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%239ca3af' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:30px;}

  .ac-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;font-size:0.72rem;font-weight:700;letter-spacing:0.2px;}
  .ac-badge-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}

  .ac-table{width:100%;border-collapse:collapse;font-size:0.84rem;}
  .ac-table th{padding:10px 14px;text-align:left;font-size:0.72rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid var(--border,#e8eaed);white-space:nowrap;}
  .ac-table td{padding:10px 14px;border-bottom:1px solid var(--border,#f3f4f6);color:var(--text-primary);vertical-align:middle;}
  .ac-table tr:last-child td{border-bottom:none;}
  .ac-table tbody tr:hover{background:rgba(99,102,241,0.03);}
  .ac-table-right{text-align:right!important;}

  .ac-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;}
  .ac-modal{background:var(--card-bg,#fff);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.18);width:100%;max-height:90vh;overflow-y:auto;animation:acModalIn .18s ease;}
  @keyframes acModalIn{from{opacity:0;transform:scale(0.95) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}
  .ac-modal-header{display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;border-bottom:1px solid var(--border,#e8eaed);}
  .ac-modal-body{padding:1.5rem;}
  .ac-modal-footer{display:flex;gap:8px;justify-content:flex-end;padding:1rem 1.5rem;border-top:1px solid var(--border,#e8eaed);background:var(--bg-subtle,#f9fafb);border-radius:0 0 16px 16px;}

  .ac-tabs{display:flex;border-bottom:2px solid var(--border,#e8eaed);gap:0;}
  .ac-tab{padding:9px 18px;font-size:0.84rem;font-weight:500;cursor:pointer;border:none;background:none;color:var(--text-secondary);border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s;white-space:nowrap;}
  .ac-tab.active,.ac-tab-active{color:${AC.colors.primary};font-weight:700;border-bottom-color:${AC.colors.primary};}
  .ac-tab:hover:not(.active):not(.ac-tab-active){color:var(--text-primary);background:rgba(99,102,241,0.04);}

  .ac-field{margin-bottom:16px;}
  .ac-label{display:block;font-size:0.8rem;font-weight:600;color:var(--text-secondary);margin-bottom:5px;}
  .ac-label-req::after{content:' *';color:${AC.colors.danger};}

  .ac-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px;color:var(--text-secondary);gap:8px;}
  .ac-empty-icon{font-size:36px;opacity:0.3;}
  .ac-empty-text{font-size:0.85rem;}

  .ac-divider{height:1px;background:var(--border,#e8eaed);margin:16px 0;}
  .ac-page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;}
  .ac-page-title{font-size:1.2rem;font-weight:800;margin:0;}
  .ac-page-sub{font-size:0.82rem;color:var(--text-secondary);margin:2px 0 0;}
  .ac-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}

  .ac-stat-up{color:#16a34a;font-size:0.75rem;font-weight:700;}
  .ac-stat-down{color:#dc2626;font-size:0.75rem;font-weight:700;}
  .ac-stat-new{color:${AC.colors.info};font-size:0.75rem;font-weight:700;}
`;

let injected = false;
export function AcStyles() {
  useEffect(() => {
    if (injected) return;
    injected = true;
    const el = document.createElement('style');
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
  }, []);
  return null;
}

// ─── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = 'primary'|'ghost'|'danger'|'success'|'link';
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: 'sm'|'md';
  icon?: string;
  loading?: boolean;
  as?: 'button'|'a';
  href?: string;
}
export function AcButton({ variant='ghost', size='md', icon, loading, children, className='', as: Tag='button', href, ...rest }: BtnProps) {
  const cls = `ac-btn ac-btn-${variant}${size==='sm'?' ac-btn-sm':''}${icon&&!children?' ac-btn-icon':''} ${className}`.trim();
  if (Tag === 'a') {
    return (
      <a href={href} className={cls}>
        {icon && <span className="material-icons-outlined" style={{fontSize:size==='sm'?14:16}}>{icon}</span>}
        {loading ? '…' : children}
      </a>
    );
  }
  return (
    <button className={cls} disabled={loading || rest.disabled} {...rest}>
      {icon && <span className="material-icons-outlined" style={{fontSize:size==='sm'?14:16}}>{icon}</span>}
      {loading ? 'Please wait…' : children}
    </button>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
const BADGE_PRESETS: Record<string, {bg:string;color:string}> = {
  open:        {bg:'#dcfce7',color:'#15803d'},
  active:      {bg:'#dcfce7',color:'#15803d'},
  success:     {bg:'#dcfce7',color:'#15803d'},
  soft_locked: {bg:'#fef3c7',color:'#92400e'},
  pending:     {bg:'#fef3c7',color:'#92400e'},
  partial:     {bg:'#fef3c7',color:'#92400e'},
  warning:     {bg:'#fef3c7',color:'#92400e'},
  locked:      {bg:'#fee2e2',color:'#991b1b'},
  closed:      {bg:'#f3f4f6',color:'#374151'},
  posted:      {bg:'rgba(99,102,241,0.1)',color:'#4f46e5'},
  draft:       {bg:'#f3f4f6',color:'#6b7280'},
  overdue:     {bg:'#fee2e2',color:'#991b1b'},
  unpaid:      {bg:'#fef3c7',color:'#92400e'},
  paid:        {bg:'#dcfce7',color:'#15803d'},
};
interface BadgeProps { status?: string; color?: string; bg?: string; dot?: boolean; children: React.ReactNode; }
export function AcBadge({ status, color, bg, dot, children }: BadgeProps) {
  const preset = status ? (BADGE_PRESETS[status] ?? BADGE_PRESETS['draft']) : null;
  const c = color ?? preset?.color ?? '#6b7280';
  const b = bg    ?? preset?.bg    ?? '#f3f4f6';
  return (
    <span className="ac-badge" style={{background:b,color:c}}>
      {dot && <span className="ac-badge-dot" style={{background:c}}/>}
      {children}
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps { children: React.ReactNode; style?: React.CSSProperties; pad?: boolean; className?: string; }
export function AcCard({ children, style, pad=true, className='' }: CardProps) {
  return <div className={`ac-card${pad?' ac-card-p':''} ${className}`} style={style}>{children}</div>;
}

// ─── Input / Select / Textarea ────────────────────────────────────────────────
export function AcInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className='', ...rest } = props;
  return <input className={`ac-input ${className}`} {...rest} />;
}
export function AcSelect(props: React.SelectHTMLAttributes<HTMLSelectElement> & {children:React.ReactNode}) {
  const { className='', children, ...rest } = props;
  return <select className={`ac-input ac-select ${className}`} {...rest}>{children}</select>;
}
export function AcTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className='', ...rest } = props;
  return <textarea className={`ac-input ac-textarea ${className}`} {...rest} />;
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
interface FieldProps { label: string; required?: boolean; hint?: string; children: React.ReactNode; }
export function AcField({ label, required, hint, children }: FieldProps) {
  const generatedId = useId();
  const fieldId = React.isValidElement(children) && typeof children.props === 'object' && children.props && 'id' in children.props && children.props.id ? String(children.props.id) : generatedId;
  const field = React.isValidElement(children) ? React.cloneElement(children as React.ReactElement<any>, { id: fieldId }) : children;

  return (
    <div className="ac-field">
      <label htmlFor={fieldId} className={`ac-label${required?' ac-label-req':''}`}>{label}</label>
      {field}
      {hint && <div style={{fontSize:'0.73rem',color:'var(--text-secondary)',marginTop:4}}>{hint}</div>}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
}
export function AcModal({ open, onClose, title, width=480, footer, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ac-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ac-modal" style={{maxWidth:width}} ref={ref}>
        <div className="ac-modal-header">
          <span style={{fontWeight:700,fontSize:'1rem'}}>{title}</span>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-secondary)',padding:4,borderRadius:6,display:'flex',alignItems:'center'}}>
            <span className="material-icons-outlined" style={{fontSize:20}}>close</span>
          </button>
        </div>
        <div className="ac-modal-body">{children}</div>
        {footer && <div className="ac-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
interface ConfirmProps { open:boolean; onClose:()=>void; onConfirm:()=>void; title:string; message:React.ReactNode; confirmLabel?:string; variant?:BtnVariant; loading?:boolean; }
export function AcConfirm({ open, onClose, onConfirm, title, message, confirmLabel='Confirm', variant='danger', loading }: ConfirmProps) {
  return (
    <AcModal open={open} onClose={onClose} title={title} width={400}
      footer={<><AcButton variant="ghost" onClick={onClose}>Cancel</AcButton><AcButton variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</AcButton></>}>
      <p style={{margin:0,fontSize:'0.88rem',color:'var(--text-secondary)',lineHeight:1.6}}>{message}</p>
    </AcModal>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
interface Col<T> { key: string; label: string; align?: 'right'|'left'|'center'; render: (row:T,idx:number)=>React.ReactNode; width?: number|string; }
interface TableProps<T> { cols: Col<T>[]; rows: T[]; keyFn?: (row:T,idx:number)=>string; empty?: string; loading?: boolean; }
export function AcTable<T>({ cols, rows, keyFn, empty='No data found.', loading }: TableProps<T>) {
  return (
    <div style={{overflowX:'auto'}}>
      <table className="ac-table">
        <thead>
          <tr>{cols.map(c=>(
            <th key={c.key} style={{textAlign:c.align??'left',width:c.width}}>{c.label}</th>
          ))}</tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={cols.length}><AcEmpty icon="hourglass_top" text="Loading…"/></td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={cols.length}><AcEmpty text={empty}/></td></tr>
          ) : rows.map((row,idx)=>(
            <tr key={keyFn?.(row,idx)??idx}>
              {cols.map(c=>(
                <td key={c.key} className={c.align==='right'?'ac-table-right':''} style={{textAlign:c.align??'left'}}>
                  {c.render(row,idx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function AcEmpty({ icon='inbox', text, action }: { icon?:string; text?:string; action?: React.ReactNode }) {
  return (
    <div className="ac-empty">
      <span className="material-icons-outlined ac-empty-icon">{icon}</span>
      <span className="ac-empty-text">{text ?? 'Nothing here yet.'}</span>
      {action}
    </div>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────
interface PageHeaderProps { title:string; subtitle?:string; actions?:React.ReactNode; badge?:React.ReactNode; }
export function AcPageHeader({ title, subtitle, actions, badge }: PageHeaderProps) {
  return (
    <div className="ac-page-header">
      <div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <h1 className="ac-page-title">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="ac-page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="ac-actions">{actions}</div>}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
interface TabDef { key: string; label: string; icon?: string; count?: number; }
interface TabsProps { tabs: TabDef[]; active: string; onChange: (k:string)=>void; }
export function AcTabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="ac-tabs" role="tablist" style={{marginBottom:20}}>
      {tabs.map(t=>(
        <button key={t.key} role="tab" aria-selected={active===t.key} className={`ac-tab${active===t.key?' active':''}`} onClick={()=>onChange(t.key)}>
          {t.icon && <span className="material-icons-outlined" style={{fontSize:15,verticalAlign:'middle',marginRight:4}}>{t.icon}</span>}
          {t.label}
          {t.count !== undefined && (
            <span style={{marginLeft:6,background:active===t.key?AC.colors.primary:'var(--border)',color:active===t.key?'#fff':'var(--text-secondary)',borderRadius:999,fontSize:'0.68rem',fontWeight:700,padding:'1px 6px'}}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
interface KpiProps {
  label: string;
  value: string;
  icon: string;
  iconColor: string;
  delta?: { value: number; label?: string; invert?: boolean };
  trend?: 'up'|'down'|'flat';
  accent?: string; // left border color
}
export function AcKpiCard({ label, value, icon, iconColor, delta, accent }: KpiProps) {
  const pct = delta?.value;
  const isNew = pct !== undefined && !isFinite(pct);
  const isUp = pct !== undefined && pct >= 0;
  const isGood = delta?.invert ? !isUp : isUp;

  return (
    <div className="ac-card ac-card-p" style={{borderLeft:`3px solid ${accent??iconColor}`,position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:0,right:0,width:80,height:80,borderRadius:'0 14px 0 80px',background:`${iconColor}0d`}}/>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12,position:'relative'}}>
        <span style={{fontSize:'0.72rem',fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.5px'}}>{label}</span>
        <span style={{width:32,height:32,borderRadius:9,background:`${iconColor}18`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <span className="material-icons-outlined" style={{fontSize:17,color:iconColor}}>{icon}</span>
        </span>
      </div>
      <div style={{fontSize:'1.55rem',fontWeight:800,letterSpacing:'-0.5px',lineHeight:1,marginBottom:6}}>{value}</div>
      {pct !== undefined && (
        <div style={{display:'flex',alignItems:'center',gap:3}}>
          {isNew ? (
            <span className="ac-stat-new">✦ New this period</span>
          ) : (
            <span className={isGood?'ac-stat-up':'ac-stat-down'}>
              <span className="material-icons-outlined" style={{fontSize:12,verticalAlign:'middle'}}>
                {isUp?'arrow_upward':'arrow_downward'}
              </span>
              {Math.abs(pct).toFixed(1)}% {delta?.label ?? 'vs prev'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
export function AcSectionHead({ title, action }: { title:string; action?:React.ReactNode }) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
      <span style={{fontWeight:700,fontSize:'0.88rem'}}>{title}</span>
      {action}
    </div>
  );
}

// ─── Amount ───────────────────────────────────────────────────────────────────
export function AcAmt({ value, color, bold=true }: { value: number; color?: string; bold?: boolean }) {
  const c = color ?? (value < 0 ? '#dc2626' : undefined);
  const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
  return <span style={{fontWeight:bold?700:400,color:c??'inherit'}}>{fmt.format(value)}</span>;
}

// ─── Divider ──────────────────────────────────────────────────────────────────
export function AcDivider({ my=16 }: { my?: number }) {
  return <div className="ac-divider" style={{margin:`${my}px 0`}}/>;
}

// ─── Loading spinner ──────────────────────────────────────────────────────────
export function AcSpinner() {
  return (
    <div style={{display:'inline-block',width:18,height:18,border:'2px solid var(--border)',borderTop:'2px solid '+AC.colors.primary,borderRadius:'50%',animation:'acSpin .6s linear infinite'}}>
      <style>{`@keyframes acSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Alert / toast banner ─────────────────────────────────────────────────────
type AlertType = 'success'|'error'|'warning'|'info';
const ALERT_MAP: Record<AlertType, {bg:string;border:string;color:string;icon:string}> = {
  success: {bg:'#f0fdf4',border:'#bbf7d0',color:'#15803d',icon:'check_circle'},
  error:   {bg:'#fef2f2',border:'#fecaca',color:'#991b1b',icon:'error'},
  warning: {bg:'#fffbeb',border:'#fde68a',color:'#92400e',icon:'warning'},
  info:    {bg:'#eff6ff',border:'#bfdbfe',color:'#1e40af',icon:'info'},
};
export function AcAlert({ type='info', children }: { type?: AlertType; children: React.ReactNode }) {
  const s = ALERT_MAP[type];
  return (
    <div className="ac-alert" style={{background:s.bg,border:`1px solid ${s.border}`,borderRadius:10,padding:'10px 14px',display:'flex',gap:10,alignItems:'flex-start',fontSize:'0.84rem',color:s.color}}>
      <span className="material-icons-outlined" style={{fontSize:17,flexShrink:0,marginTop:1}}>{s.icon}</span>
      <span>{children}</span>
    </div>
  );
}
