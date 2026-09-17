'use client';

import { useState } from 'react';

type RoutePoint = {
  lat: number;
  lng: number;
  time: string | Date;
  type: string;
  accuracyM?: number | null;
  isMocked?: boolean;
};

type CollectionPoint = {
  id: string;
  lat: number;
  lng: number;
  customerName: string;
  amount: number;
  time: string | Date;
  locationStatus: string;
};

export type RouteAgent = {
  agentId: string;
  agentName: string;
  branchId?: string | null;
  lastLocation?: { lat: number; lng: number; time: string | Date } | null;
  minutesSinceLastPing: number | null;
  collectionsDoneToday: number;
  alerts: (string | null)[];
  path: RoutePoint[];
  collectionPoints: CollectionPoint[];
};

function formatPingTime(time: string | Date) {
  try {
    const d = new Date(time);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return String(time);
  }
}

function getPingBadge(type: string) {
  switch (type?.toLowerCase()) {
    case 'collection':
      return {
        label: 'Collection',
        bg: 'rgba(34, 197, 94, 0.12)',
        color: 'var(--success)',
        icon: 'payments',
      };
    case 'duty_start':
      return {
        label: 'Duty Start',
        bg: 'rgba(147, 51, 234, 0.12)',
        color: '#9333ea',
        icon: 'play_circle',
      };
    case 'duty_end':
      return {
        label: 'Duty End',
        bg: 'rgba(100, 116, 139, 0.12)',
        color: '#64748b',
        icon: 'stop_circle',
      };
    case 'heartbeat':
    default:
      return {
        label: 'Heartbeat',
        bg: 'rgba(59, 130, 246, 0.12)',
        color: 'var(--info)',
        icon: 'sensors',
      };
  }
}

function formatAlertLabel(alert: string | null | undefined) {
  if (!alert) return '';
  switch (alert) {
    case 'offline_30m':
      return 'Offline > 30m';
    case 'not_moved_2h':
      return 'Stationary > 2h';
    case 'multiple_mismatches':
      return 'Multiple Mismatches';
    default:
      return alert.replace(/_/g, ' ');
  }
}

export default function AgentMovementTable({
  agents,
  dict,
}: {
  agents: RouteAgent[];
  dict: any;
}) {
  const d = dict.routeTracker || {};
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'collection' | 'heartbeat'>('all');

  const filteredAgents = agents.filter((agent) =>
    agent.agentName.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const toggleExpand = (agentId: string) => {
    setExpandedAgentId((prev) => (prev === agentId ? null : agentId));
    setFilterType('all');
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>near_me</span>
          <h3 style={{ margin: 0 }}>{d.agentMovement || 'Agent Movement'}</h3>
          <span className="badge badge-secondary" style={{ fontSize: '.75rem' }}>
            {agents.length} {d.agents || 'Agents'}
          </span>
        </div>
        {agents.length > 3 && (
          <div style={{ position: 'relative', minWidth: '200px' }}>
            <input
              type="text"
              placeholder="Search agent..."
              className="form-control"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '6px 12px 6px 30px', fontSize: '.8rem', height: '32px' }}
            />
            <span
              className="material-icons-outlined"
              style={{ position: 'absolute', left: '8px', top: '7px', fontSize: '16px', color: 'var(--text-light)' }}
            >
              search
            </span>
          </div>
        )}
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>{d.agent || 'Agent'}</th>
              <th>{d.lastSeen || 'Last Seen'}</th>
              <th>{d.collections || 'Collections'}</th>
              <th>{d.routePoints || 'Route Points'}</th>
              <th>{d.alerts || 'Alerts'}</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAgents.map((agent) => {
              const isExpanded = expandedAgentId === agent.agentId;
              const isOnline = agent.minutesSinceLastPing !== null && agent.minutesSinceLastPing <= 5;
              const isIdle = agent.minutesSinceLastPing !== null && agent.minutesSinceLastPing <= 30;

              const visiblePoints = agent.path.filter((p) => {
                if (filterType === 'all') return true;
                if (filterType === 'collection') return p.type === 'collection';
                if (filterType === 'heartbeat') return p.type === 'heartbeat';
                return true;
              });

              return (
                <FragmentWrapper key={agent.agentId}>
                  <tr
                    onClick={() => toggleExpand(agent.agentId)}
                    style={{ cursor: 'pointer', background: isExpanded ? 'rgba(59,130,246,0.04)' : undefined }}
                  >
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className="material-icons-outlined"
                        style={{
                          fontSize: '18px',
                          color: 'var(--text-light)',
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.2s ease',
                        }}
                      >
                        chevron_right
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: isOnline ? 'var(--success)' : isIdle ? 'var(--warning)' : 'var(--text-light)',
                            display: 'inline-block',
                          }}
                          title={isOnline ? 'Online' : isIdle ? 'Recently Active' : 'Offline'}
                        />
                        <strong style={{ fontSize: '.9rem' }}>{agent.agentName}</strong>
                      </div>
                    </td>
                    <td>
                      {agent.minutesSinceLastPing === null ? (
                        <span style={{ color: 'var(--text-light)', fontSize: '.85rem' }}>{d.noGpsToday || 'No GPS today'}</span>
                      ) : (
                        <span style={{ fontSize: '.85rem', color: isOnline ? 'var(--success)' : 'var(--text-secondary)' }}>
                          {agent.minutesSinceLastPing === 0 ? 'Just now' : `${agent.minutesSinceLastPing} ${d.minAgo || 'min ago'}`}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '.8rem' }}>
                        {agent.collectionsDoneToday}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '.85rem' }}>
                        {agent.path.length}
                      </span>
                    </td>
                    <td>
                      {agent.alerts.filter((a): a is string => Boolean(a)).length > 0 ? (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {agent.alerts.filter((a): a is string => Boolean(a)).map((a, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: '.7rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(239, 68, 68, 0.12)',
                                color: 'var(--danger)',
                                fontWeight: 600,
                              }}
                            >
                              {formatAlertLabel(a)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-light)' }}>-</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(agent.agentId);
                        }}
                        style={{ fontSize: '.75rem', padding: '3px 8px' }}
                      >
                        {isExpanded ? (d.hideTrail || 'Hide Trail') : (d.viewTrail || 'View Trail')}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Movement Trail Row */}
                  {isExpanded && (
                    <tr style={{ background: 'rgba(0,0,0,0.015)' }}>
                      <td colSpan={7} style={{ padding: '14px 18px 20px 36px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>
                                timeline
                              </span>
                              <strong style={{ fontSize: '.85rem' }}>
                                {d.movementTrail || 'Movement Trail'} &bull; {agent.agentName}
                              </strong>
                              <span style={{ fontSize: '.75rem', color: 'var(--text-light)' }}>
                                ({agent.path.length} {d.totalPoints || 'Total Points'})
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  className={`btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                                  onClick={() => setFilterType('all')}
                                  style={{ padding: '2px 8px', fontSize: '.75rem' }}
                                >
                                  All ({agent.path.length})
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-sm ${filterType === 'collection' ? 'btn-primary' : 'btn-secondary'}`}
                                  onClick={() => setFilterType('collection')}
                                  style={{ padding: '2px 8px', fontSize: '.75rem' }}
                                >
                                  Collections ({agent.path.filter((p) => p.type === 'collection').length})
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-sm ${filterType === 'heartbeat' ? 'btn-primary' : 'btn-secondary'}`}
                                  onClick={() => setFilterType('heartbeat')}
                                  style={{ padding: '2px 8px', fontSize: '.75rem' }}
                                >
                                  Heartbeats ({agent.path.filter((p) => p.type === 'heartbeat').length})
                                </button>
                              </div>

                              {agent.lastLocation && (
                                <a
                                  href={`https://www.google.com/maps?q=${agent.lastLocation.lat},${agent.lastLocation.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '2px 8px', fontSize: '.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>pin_drop</span>
                                  Latest Point
                                </a>
                              )}
                            </div>
                          </div>

                          {agent.path.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)', fontSize: '.85rem', background: 'var(--bg-alt)', borderRadius: '6px' }}>
                              <span className="material-icons-outlined" style={{ fontSize: '28px', color: 'var(--text-light)', marginBottom: '4px', display: 'block' }}>
                                location_off
                              </span>
                              {d.noPingsToday || 'No location pings recorded for this agent today.'}
                            </div>
                          ) : visiblePoints.length === 0 ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-light)', fontSize: '.85rem' }}>
                              No points match the selected filter.
                            </div>
                          ) : (
                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--card-bg)' }}>
                              <table style={{ margin: 0, fontSize: '.8rem' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-alt)', zIndex: 1 }}>
                                  <tr>
                                    <th style={{ width: '40px' }}>#</th>
                                    <th>{d.pingTime || 'Time'}</th>
                                    <th>{d.pingType || 'Type'}</th>
                                    <th>{d.coordinates || 'Coordinates'}</th>
                                    <th>{d.accuracy || 'Accuracy'}</th>
                                    <th style={{ textAlign: 'right' }}>{d.openInMap || 'Open in Map'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {visiblePoints.map((point, idx) => {
                                    const badge = getPingBadge(point.type);
                                    return (
                                      <tr key={idx}>
                                        <td style={{ color: 'var(--text-light)' }}>{idx + 1}</td>
                                        <td style={{ fontWeight: 500 }}>{formatPingTime(point.time)}</td>
                                        <td>
                                          <span
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              background: badge.bg,
                                              color: badge.color,
                                              fontSize: '.72rem',
                                              fontWeight: 600,
                                            }}
                                          >
                                            <span className="material-icons-outlined" style={{ fontSize: '13px' }}>
                                              {badge.icon}
                                            </span>
                                            {badge.label}
                                          </span>
                                          {point.isMocked && (
                                            <span
                                              style={{
                                                marginLeft: '6px',
                                                padding: '2px 5px',
                                                borderRadius: '3px',
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                color: 'var(--danger)',
                                                fontSize: '.68rem',
                                                fontWeight: 700,
                                              }}
                                            >
                                              Mock GPS
                                            </span>
                                          )}
                                        </td>
                                        <td>
                                          <span style={{ fontFamily: 'monospace', fontSize: '.78rem' }}>
                                            {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                                          </span>
                                        </td>
                                        <td>
                                          {point.accuracyM != null ? (
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '.75rem' }}>
                                              &plusmn;{Math.round(point.accuracyM)}m
                                            </span>
                                          ) : (
                                            <span style={{ color: 'var(--text-light)' }}>&mdash;</span>
                                          )}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                          <a
                                            href={`https://www.google.com/maps?q=${point.lat},${point.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-ghost btn-sm"
                                            style={{ padding: '2px 6px', fontSize: '.72rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                          >
                                            <span className="material-icons-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                                            Map
                                          </a>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </FragmentWrapper>
              );
            })}

            {filteredAgents.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-light)' }}>
                  {d.noActiveAgents || 'No active agents found for this branch.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// React fragment wrapper for valid table DOM structure
function FragmentWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
