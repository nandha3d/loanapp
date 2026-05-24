'use client';

import { getCreditScoreGaugePresentation } from '@/lib/creditScoreGauge';
import type { BureauSummary } from '@/lib/bureau/bureauService';

interface BureauReportCardProps {
  report: BureauSummary;
}

export function BureauReportCard({ report }: BureauReportCardProps) {
  if (report.status === 'no_match') {
    return (
      <div className="card" style={{ padding: '20px', border: '1px solid var(--border)', background: 'var(--bg-alt)', borderRadius: 'var(--radius)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)' }}>
          <span className="material-icons-outlined">info</span>
          <strong>No Credit History (NH / NA)</strong>
        </div>
        <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginTop: '8px', marginBottom: '12px' }}>
          This customer has no historical credit records in the bureau (New to Credit).
        </p>
        <small style={{ color: 'var(--text-light)', display: 'block', fontSize: '.72rem' }}>
          Report ID: {report.reportId} · Provider: {report.bureauProvider}
        </small>
      </div>
    );
  }

  if (report.status === 'error') {
    return (
      <div className="card" style={{ padding: '20px', border: '1px solid var(--danger)', background: 'rgba(231, 76, 60, 0.05)', borderRadius: 'var(--radius)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
          <span className="material-icons-outlined">error_outline</span>
          <strong>Bureau Pull Error</strong>
        </div>
        <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
          An error occurred while pulling the credit report. Please check configuration or try again.
        </p>
      </div>
    );
  }

  const score = report.creditScore || 300;
  const grade = report.scoreLabel || 'NA';
  const gauge = getCreditScoreGaugePresentation(score, grade);

  const riskFlags = [
    {
      label: 'Active MFI Loans',
      value: report.activeMFILoans,
      warn: report.activeMFILoans >= 3,
      tooltip: 'RBI limits MFI borrowers to max 3 simultaneous loans',
    },
    {
      label: 'Enquiries (90 days)',
      value: report.enquiryCount90d,
      warn: report.enquiryCount90d >= 5,
      tooltip: '5+ enquiries in 90 days suggests serial borrowing credit hunger',
    },
    {
      label: 'Overdue Accounts',
      value: report.overdueAccounts,
      warn: report.overdueAccounts > 0,
      tooltip: 'Any active overdue account across other lenders',
    },
    {
      label: 'Written-off Accounts',
      value: report.writtenOffAccounts,
      warn: report.writtenOffAccounts > 0,
      tooltip: 'Historical loans written off due to non-payment',
    },
    {
      label: 'Suit Filed Accounts',
      value: report.suitFiledAccounts,
      warn: report.suitFiledAccounts > 0,
      tooltip: 'Legal action has been filed by a past lender',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Sandbox warning banner */}
      {report.source === 'platform_default' && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)', 
          border: '1px solid var(--warning)', 
          color: 'var(--warning-dark, #b45309)',
          padding: '12px', 
          borderRadius: 'var(--radius-sm)', 
          fontSize: '.8rem',
          display: 'flex',
          gap: '8px',
          alignItems: 'start'
        }}>
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>warning</span>
          <div>
            <strong>SANDBOX MODE:</strong> Simulating test credentials. Configure your own CRIF member credentials in settings to pull production reports.
          </div>
        </div>
      )}

      {/* Cache Badge */}
      {report.fromCache && (
        <div style={{
          background: 'var(--primary-light)',
          border: '1px solid var(--border)',
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '.75rem',
          color: 'var(--primary-dark)',
          textAlign: 'center',
          fontWeight: 600
        }}>
          ⚡ Loading Cached Report (Valid until {new Date(report.validUntil).toLocaleDateString('en-IN')})
        </div>
      )}

      {/* SVG Score Gauge Dial */}
      <div style={{ 
        background: 'var(--bg-alt)', 
        border: '1px solid var(--border)', 
        padding: '20px 10px', 
        borderRadius: 'var(--radius-md)', 
        textAlign: 'center' 
      }}>
        <div style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '1.2px', opacity: 0.6, marginBottom: '8px', fontWeight: 700 }}>
          {report.bureauProvider} Bureau Score
        </div>
        
        <div style={{ position: 'relative', height: '80px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
          <svg viewBox="0 0 100 55" role="img" aria-label={gauge.ariaLabel} style={{ width: '140px' }}>
            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="10" strokeLinecap="round" />
            <path d="M 10 50 A 40 40 0 0 1 30 15.3" fill="none" stroke="var(--danger)" strokeWidth="10" />
            <path d="M 30 15.3 A 40 40 0 0 1 50 10" fill="none" stroke="var(--warning)" strokeWidth="10" />
            <path d="M 50 10 A 40 40 0 0 1 70 15.3" fill="none" stroke="#EAB308" strokeWidth="10" />
            <path d="M 70 15.3 A 40 40 0 0 1 90 50" fill="none" stroke="var(--success)" strokeWidth="10" />
            <g style={{ transform: `rotate(${gauge.rotation}deg)`, transformOrigin: '50px 50px', transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <circle cx="50" cy="10" r="5" fill="#FFF" stroke={gauge.color} strokeWidth="2" />
            </g>
          </svg>
          <div style={{ position: 'absolute', bottom: '5px', fontSize: '2.4rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px' }}>{score}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.6rem', color: 'var(--text-light)', marginTop: '-12px', padding: '0 4px', fontWeight: 700, width: '140px', margin: '0 auto' }}>
          <span>300</span>
          <span>850</span>
        </div>
        <div style={{ fontSize: '.9rem', fontWeight: 800, color: gauge.color, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px' }}>
          {grade}
        </div>
      </div>

      {/* Risk Factors indicators */}
      <div>
        <h4 style={{ fontSize: '.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.8px', marginBottom: '10px', fontWeight: 700 }}>
          ⚠️ Risk Indicators
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {riskFlags.map((flag) => (
            <div 
              key={flag.label} 
              title={flag.tooltip}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: flag.warn ? 'rgba(231, 76, 60, 0.04)' : 'var(--bg)',
                border: flag.warn ? '1px solid rgba(231, 76, 60, 0.2)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '.82rem'
              }}
            >
              <span style={{ color: flag.warn ? 'var(--danger)' : 'var(--text)' }}>
                {flag.label}
              </span>
              <span style={{ fontWeight: 700, color: flag.warn ? 'var(--danger)' : 'var(--text)' }}>
                {flag.value} {flag.warn && '⚠️'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Account Details list */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <h4 style={{ fontSize: '.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.8px', marginBottom: '10px', fontWeight: 700 }}>
          📊 Account Aggregation
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ background: 'var(--bg-alt)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.68rem', color: 'var(--text-light)' }}>Total Tradelines</div>
            <div style={{ fontSize: '.95rem', fontWeight: 700 }}>{report.totalAccounts}</div>
          </div>
          <div style={{ background: 'var(--bg-alt)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.68rem', color: 'var(--text-light)' }}>Active Accounts</div>
            <div style={{ fontSize: '.95rem', fontWeight: 700 }}>{report.activeAccounts}</div>
          </div>
          <div style={{ background: 'var(--bg-alt)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.68rem', color: 'var(--text-light)' }}>Total Overdue</div>
            <div style={{ fontSize: '.95rem', fontWeight: 700, color: report.totalOverdueAmt > 0 ? 'var(--danger)' : 'var(--text)' }}>
              ₹{report.totalOverdueAmt.toLocaleString('en-IN')}
            </div>
          </div>
          <div style={{ background: 'var(--bg-alt)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.68rem', color: 'var(--text-light)' }}>Active MFI Balance</div>
            <div style={{ fontSize: '.95rem', fontWeight: 700 }}>
              ₹{report.activeMFILoanAmt.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* Stored check audit label */}
      <div style={{ fontSize: '.7rem', color: 'var(--text-light)', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
        Report ID: {report.reportId} · Checked on {new Date().toLocaleDateString('en-IN')}
      </div>
    </div>
  );
}
