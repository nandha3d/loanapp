'use client';

import { useState } from 'react';
import {
  exportTallyXml,
  exportJsonDump,
  exportExcelWorkbook,
  testTallyConnector,
  pushToTally,
} from './actions';

interface ExportRun {
  id: string;
  kind: 'tally_xml' | 'excel' | 'json';
  periodKey: string;
  filename: string;
  fileSize: number;
  createdAt: string;
  byUser?: { name: string } | null;
}

interface ExportClientProps {
  module: string;
  exportRuns: ExportRun[];
  settings: {
    tallyConnectorEnabled: boolean;
    tallyConnectorUrl: string | null;
    tallyCompanyName: string | null;
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function dateToPeriodKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ExportClient({ module, exportRuns: initialRuns, settings }: ExportClientProps) {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [runs, setRuns] = useState<ExportRun[]>(initialRuns);

  // Toast state
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // Downloading state
  const [downloading, setDownloading] = useState<string | null>(null);

  // Tally connector state
  const [connectorStatus, setConnectorStatus] = useState<{ ok: boolean; company?: string; error?: string } | null>(null);
  const [testingConnector, setTestingConnector] = useState(false);
  const [pushResult, setPushResult] = useState<{ created: number; ignored: number; errors: string[] } | null>(null);
  const [pushing, setPushing] = useState(false);

  async function handleDownloadTallyXml() {
    setDownloading('tally_xml');
    try {
      const periodKey = dateToPeriodKey(from);
      const result = await exportTallyXml(periodKey);
      const blob = new Blob([result.xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${result.filename}`);
    } catch (e: any) {
      showToast(e?.message ?? 'Export failed', false);
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadJson() {
    setDownloading('json');
    try {
      const result = await exportJsonDump(from, to);
      const blob = new Blob([result.json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${result.filename}`);
    } catch (e: any) {
      showToast(e?.message ?? 'Export failed', false);
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadExcel() {
    setDownloading('excel');
    try {
      const periodKey = dateToPeriodKey(from);
      const result = await exportExcelWorkbook(periodKey);
      // result.buffer is base64
      const binary = atob(result.buffer);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${result.filename}`);
    } catch (e: any) {
      showToast(e?.message ?? 'Export failed', false);
    } finally {
      setDownloading(null);
    }
  }

  async function handleTestConnector() {
    if (!settings.tallyConnectorUrl) return;
    setTestingConnector(true);
    setConnectorStatus(null);
    try {
      const res = await testTallyConnector(settings.tallyConnectorUrl);
      setConnectorStatus(res);
      showToast(res.ok ? `Connected${res.company ? ` — ${res.company}` : ''}` : `Failed: ${res.error}`, res.ok);
    } catch (e: any) {
      showToast(e?.message ?? 'Test failed', false);
    } finally {
      setTestingConnector(false);
    }
  }

  async function handlePushToTally() {
    setPushing(true);
    setPushResult(null);
    try {
      const periodKey = dateToPeriodKey(from);
      const res = await pushToTally(periodKey);
      setPushResult(res);
      showToast(`Push complete: ${res.created} created, ${res.ignored} ignored, ${res.errors.length} errors`, res.errors.length === 0);
    } catch (e: any) {
      showToast(e?.message ?? 'Push failed', false);
    } finally {
      setPushing(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px',
    borderRadius: 7,
    border: '1px solid var(--border, #e5e7eb)',
    fontSize: '0.9rem',
    background: 'var(--card-bg, #fff)',
    color: 'var(--text-primary, #111)',
  };

  const btnStyle = (disabled?: boolean): React.CSSProperties => ({
    padding: '7px 16px',
    borderRadius: 7,
    border: 'none',
    fontSize: '0.87rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? 'var(--bg-subtle, #f3f4f6)' : 'var(--primary, #2563eb)',
    color: disabled ? 'var(--text-secondary, #6b7280)' : '#fff',
    opacity: disabled ? 0.7 : 1,
  });

  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg, #fff)',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 12,
    padding: '1.25rem',
    marginBottom: 16,
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 999,
            padding: '10px 18px',
            borderRadius: 8,
            background: toast.ok ? '#16a34a' : '#dc2626',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.88rem',
            boxShadow: '0 4px 16px rgba(0,0,0,.15)',
          }}
        >
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>⬇️ Export Accounting Data</h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary, #6b7280)' }}>
          Download journal data in multiple formats or push to Tally.
        </p>
      </div>

      {/* Period selector */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Select Period</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #6b7280)', display: 'block', marginBottom: 4 }}>
              From
            </label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #6b7280)', display: 'block', marginBottom: 4 }}>
              To
            </label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #6b7280)', marginTop: 16 }}>
            Period key: <strong>{dateToPeriodKey(from)}</strong>
          </div>
        </div>
      </div>

      {/* Export options */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 600, marginBottom: 14 }}>Export Options</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Tally XML */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e7eb)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Tally XML</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
                Import vouchers directly into Tally ERP / Prime
              </div>
            </div>
            <button
              onClick={handleDownloadTallyXml}
              disabled={downloading === 'tally_xml'}
              style={btnStyle(downloading === 'tally_xml')}
            >
              {downloading === 'tally_xml' ? 'Exporting…' : '⬇️ Download XML'}
            </button>
          </div>

          {/* Excel */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e7eb)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Excel Workbook</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
                Journal book in .xlsx format (Cover + Journal Book sheets)
              </div>
            </div>
            <button
              onClick={handleDownloadExcel}
              disabled={downloading === 'excel'}
              style={btnStyle(downloading === 'excel')}
            >
              {downloading === 'excel' ? 'Exporting…' : '⬇️ Download Excel'}
            </button>
          </div>

          {/* JSON */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e7eb)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>JSON Dump</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
                Full data export — accounts, journal entries, bills, period status
              </div>
            </div>
            <button
              onClick={handleDownloadJson}
              disabled={downloading === 'json'}
              style={btnStyle(downloading === 'json')}
            >
              {downloading === 'json' ? 'Exporting…' : '⬇️ Download JSON'}
            </button>
          </div>
        </div>
      </div>

      {/* Tally Connector section */}
      {settings.tallyConnectorEnabled && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 600, marginBottom: 14 }}>🔌 Tally Connector</div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #6b7280)', display: 'block', marginBottom: 4 }}>
              Connector URL
            </label>
            <input
              type="text"
              value={settings.tallyConnectorUrl ?? ''}
              readOnly
              style={{ ...inputStyle, width: '100%', maxWidth: 420, background: 'var(--bg-subtle, #f9fafb)', cursor: 'default' }}
            />
          </div>

          {settings.tallyCompanyName && (
            <div style={{ marginBottom: 12, fontSize: '0.85rem', color: 'var(--text-secondary, #6b7280)' }}>
              Company: <strong style={{ color: 'var(--text-primary, #111)' }}>{settings.tallyCompanyName}</strong>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: connectorStatus ? 10 : 0 }}>
            <button
              onClick={handleTestConnector}
              disabled={testingConnector || !settings.tallyConnectorUrl}
              style={{
                ...btnStyle(testingConnector || !settings.tallyConnectorUrl),
                background: testingConnector ? undefined : 'var(--bg-subtle, #f3f4f6)',
                color: testingConnector ? undefined : 'var(--text-primary, #111)',
                border: '1px solid var(--border, #e5e7eb)',
              }}
            >
              {testingConnector ? 'Testing…' : 'Test Connection'}
            </button>
            <button
              onClick={handlePushToTally}
              disabled={pushing || !settings.tallyConnectorUrl}
              style={btnStyle(pushing || !settings.tallyConnectorUrl)}
            >
              {pushing ? 'Pushing…' : '🚀 Push Vouchers'}
            </button>
          </div>

          {connectorStatus && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 7,
                background: connectorStatus.ok ? '#dcfce7' : '#fee2e2',
                color: connectorStatus.ok ? '#15803d' : '#991b1b',
                fontSize: '0.85rem',
                fontWeight: 500,
                marginTop: 8,
              }}
            >
              {connectorStatus.ok
                ? `✓ Connected${connectorStatus.company ? ` — ${connectorStatus.company}` : ''}`
                : `✗ ${connectorStatus.error}`}
            </div>
          )}

          {pushResult && (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 7,
                  background: pushResult.errors.length === 0 ? '#dcfce7' : '#fef9c3',
                  color: pushResult.errors.length === 0 ? '#15803d' : '#854d0e',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  marginBottom: pushResult.errors.length > 0 ? 6 : 0,
                }}
              >
                {pushResult.created} created · {pushResult.ignored} ignored · {pushResult.errors.length} errors
              </div>
              {pushResult.errors.length > 0 && (
                <ul style={{ margin: '6px 0 0 0', padding: '0 0 0 18px', fontSize: '0.8rem', color: '#991b1b' }}>
                  {pushResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recent export runs */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 600, marginBottom: 14 }}>Recent Exports</div>

        {runs.length === 0 ? (
          <p style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '0.85rem', margin: 0 }}>
            No exports yet.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border, #e5e7eb)', color: 'var(--text-secondary, #6b7280)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Kind</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Period</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Filename</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>Size</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>By</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>At</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    style={{ borderBottom: '1px solid var(--border, #f3f4f6)' }}
                  >
                    <td style={{ padding: '7px 8px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background:
                            run.kind === 'tally_xml'
                              ? '#dbeafe'
                              : run.kind === 'excel'
                                ? '#dcfce7'
                                : '#fef9c3',
                          color:
                            run.kind === 'tally_xml'
                              ? '#1d4ed8'
                              : run.kind === 'excel'
                                ? '#15803d'
                                : '#854d0e',
                        }}
                      >
                        {run.kind.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '7px 8px' }}>{run.periodKey}</td>
                    <td style={{ padding: '7px 8px', fontFamily: 'monospace', fontSize: '0.78rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {run.filename}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>{formatBytes(run.fileSize)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-secondary, #6b7280)' }}>
                      {run.byUser?.name ?? '—'}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-secondary, #6b7280)' }}>
                      {new Date(run.createdAt).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
