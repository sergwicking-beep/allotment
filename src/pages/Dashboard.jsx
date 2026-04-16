import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { useWeather, getSowableBySoilTemp } from '../hooks/useWeather';
import {
  getCropById,
  CROPS,
  isSowableInMonth,
  getFamilyColor,
  getFamilyBgColor,
} from '../data/crops';

// ── helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES_FULL = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.round((Date.now() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr + 'T12:00:00').getTime() - Date.now()) / 86400000);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// ── sub-components ────────────────────────────────────────────────────────────

function WeatherWidget({ weather, loading, error }) {
  if (loading) {
    return (
      <div className="card">
        <div className="card-header"><span className="card-title">Sheffield Weather</span></div>
        <div className="card-body"><div className="spinner" /></div>
      </div>
    );
  }
  if (error || !weather) {
    return (
      <div className="card">
        <div className="card-header"><span className="card-title">Sheffield Weather</span></div>
        <div className="card-body">
          <p className="text-sm text-muted">{error ? `Weather unavailable: ${error}` : 'No data'}</p>
        </div>
      </div>
    );
  }

  const { today, forecast, last7Rain, soilTemp, frostRisk, wateringAlert, lowestForecastTemp } = weather;

  return (
    <div className="card weather-card">
      <div className="card-header">
        <span className="card-title">Sheffield Weather</span>
        <span className="text-xs text-muted">Open-Meteo</span>
      </div>
      <div className="card-body" style={{ paddingBottom: '0.75rem' }}>
        {/* Today snapshot */}
        <div className="weather-today">
          <div className="weather-today-temp">
            {today.max !== null ? `${Math.round(today.max)}°C` : '—'}
            <span className="weather-today-low">/{today.min !== null ? `${Math.round(today.min)}°` : '—'}</span>
          </div>
          <div className="weather-today-stats">
            <div className="weather-stat-chip">
              <span>🌧</span>
              <span>{today.rain.toFixed(1)} mm today</span>
            </div>
            <div className="weather-stat-chip">
              <span>📅</span>
              <span>{last7Rain} mm / 7 days</span>
            </div>
            {soilTemp !== null && (
              <div className="weather-stat-chip">
                <span>🌡</span>
                <span>Soil ~{soilTemp}°C</span>
              </div>
            )}
          </div>
        </div>

        {/* 7-day strip */}
        <div className="forecast-strip">
          {forecast.slice(0, 7).map(day => {
            const date = new Date(day.date + 'T12:00:00');
            const isWet = day.rain >= 5;
            const isDamp = day.rain > 0 && day.rain < 5;
            const isCold = day.min !== null && day.min <= 2;
            return (
              <div key={day.date} className={`forecast-day ${isCold ? 'frost' : ''}`}>
                <span className="forecast-day-name">{DAY_NAMES[date.getDay()]}</span>
                <span className="forecast-day-temp">{day.max !== null ? `${Math.round(day.max)}°` : '—'}</span>
                <span className={`forecast-day-rain ${isWet ? 'wet' : isDamp ? 'damp' : 'dry'}`}>
                  {day.rain > 0 ? `${Math.round(day.rain)}` : '·'}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted" style={{ marginTop: '0.35rem' }}>Rain in mm · blue = frost risk</p>
      </div>
    </div>
  );
}

function AlertBanner({ type, icon, title, text }) {
  return (
    <div className={`alert alert-${type}`}>
      <span className="alert-icon">{icon}</span>
      <div className="alert-body">
        <div className="alert-title">{title}</div>
        {text && <div className="alert-text">{text}</div>}
      </div>
    </div>
  );
}

function StatPill({ value, label, to }) {
  const inner = (
    <div className="dash-stat">
      <span className="dash-stat-value">{value}</span>
      <span className="dash-stat-label">{label}</span>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

// ── main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { state } = useApp();
  const { beds, assignments, coldFrameEntries, seedStock } = state;
  const { weather, loading: weatherLoading, error: weatherError } = useWeather();

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth() + 1; // 1-indexed
  const currentYear = new Date().getFullYear();
  const weekAhead = addDays(today, 7);

  const dateDisplay = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── derived data ─────────────────────────────────────────────────────────────

  const activeBeds = beds.filter(b => b.active);

  const activeAssignments = assignments.filter(a => a.status !== 'harvested');
  const inGround = activeAssignments.filter(a => a.sowDate && a.sowDate <= today);
  const upcomingPlanned = activeAssignments.filter(a => a.sowDate && a.sowDate > today && a.sowDate <= weekAhead);

  // Succession reminders due this week
  const successionDue = useMemo(() => {
    return activeAssignments.reduce((acc, a) => {
      if (!a.successionIntervalWeeks || !a.sowDate) return acc;
      const nextSow = addDays(a.sowDate, a.successionIntervalWeeks * 7);
      if (nextSow >= today && nextSow <= weekAhead) {
        const crop = getCropById(a.cropId);
        acc.push({ id: a.id, crop, nextSow, intervalWeeks: a.successionIntervalWeeks });
      }
      return acc;
    }, []);
  }, [activeAssignments, today, weekAhead]);

  // Cold frame entries needing attention (within 2 weeks of expected transplant)
  const coldFrameAlerts = useMemo(() => {
    return coldFrameEntries.filter(e => {
      const crop = getCropById(e.cropId);
      if (!crop || !e.sowDate) return false;
      const weeksTarget = crop.weeksInColdFrame || 6;
      const daysOld = daysSince(e.sowDate) ?? 0;
      // Alert if they're in the "harden off" window (last 2 weeks before transplant)
      return daysOld >= (weeksTarget - 2) * 7;
    });
  }, [coldFrameEntries]);

  // Sowable this month from the full crop database
  const sowableThisMonth = useMemo(
    () => CROPS.filter(c => isSowableInMonth(c, currentMonth)),
    [currentMonth]
  );

  // Sowable by soil temperature
  const sowableByTemp = useMemo(
    () => weather?.soilTemp != null ? getSowableBySoilTemp(weather.soilTemp, CROPS) : [],
    [weather]
  );

  // Seed stock warnings: planned crops with no seed in stock
  const missingSeeds = useMemo(() => {
    const stockedIds = new Set(seedStock.map(s => s.cropId));
    return [...new Set(activeAssignments.map(a => a.cropId))]
      .filter(id => !stockedIds.has(id))
      .map(id => getCropById(id))
      .filter(Boolean);
  }, [activeAssignments, seedStock]);

  // Expired / expiring seeds
  const expiredSeeds = seedStock.filter(s => s.expiryYear && s.expiryYear <= currentYear);
  const expiringSoon = seedStock.filter(s => s.expiryYear && s.expiryYear === currentYear + 1);

  // ── alerts list ──────────────────────────────────────────────────────────────

  const alerts = [];

  if (weather?.wateringAlert) {
    alerts.push({
      type: 'warning', icon: '💧',
      title: 'Watering needed',
      text: `Only ${weather.last7Rain} mm rain in the last 7 days with little more forecast. Water thirsty crops.`,
    });
  }
  if (weather?.frostRisk) {
    alerts.push({
      type: 'danger', icon: '❄️',
      title: 'Frost risk in next 7 days',
      text: `Temperatures down to ${weather.lowestForecastTemp}°C forecast. Protect tender plants and close the cold frame at night.`,
    });
  }
  if (missingSeeds.length > 0) {
    alerts.push({
      type: 'warning', icon: '🌰',
      title: `No seeds logged for ${missingSeeds.length} planned crop${missingSeeds.length > 1 ? 's' : ''}`,
      text: `${missingSeeds.map(c => c.name).join(', ')} — check your seed stock.`,
    });
  }
  if (expiredSeeds.length > 0) {
    alerts.push({
      type: 'warning', icon: '⏰',
      title: `${expiredSeeds.length} seed packet${expiredSeeds.length > 1 ? 's' : ''} past expiry`,
      text: 'Check germination before sowing or replace.',
    });
  }

  // ── task list ────────────────────────────────────────────────────────────────

  const tasks = [
    ...upcomingPlanned.map(a => {
      const crop = getCropById(a.cropId);
      const bed = beds.find(b => b.id === a.bedId);
      return {
        id: `sow-${a.id}`, icon: '🌱',
        title: `Sow ${crop?.name || a.cropId}`,
        meta: `${formatDateShort(a.sowDate)}${bed ? ` · ${bed.name}` : ''}${a.variety ? ` · ${a.variety}` : ''}`,
        link: '/calendar',
      };
    }),
    ...successionDue.map(s => ({
      id: `suc-${s.id}`, icon: '🔁',
      title: `Succession sow ${s.crop?.name || ''}`,
      meta: `Due ${formatDateShort(s.nextSow)} · every ${s.intervalWeeks} weeks`,
      link: '/calendar',
    })),
    ...coldFrameAlerts.map(e => {
      const crop = getCropById(e.cropId);
      const daysOld = daysSince(e.sowDate) ?? 0;
      return {
        id: `cf-${e.id}`, icon: '🏡',
        title: `Harden off ${crop?.name || e.cropId}`,
        meta: `${Math.round(daysOld / 7)} weeks in cold frame · ready to transplant soon`,
        link: '/cold-frame',
      };
    }),
  ];

  const hasAnyData = beds.length > 0 || assignments.length > 0 || coldFrameEntries.length > 0;

  // ── render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{dateDisplay}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/plot" className="btn btn-secondary btn-sm">+ Add Bed</Link>
          <Link to="/calendar" className="btn btn-primary btn-sm">Plan Crops</Link>
        </div>
      </div>

      {/* Stat pills */}
      <div className="dash-stats-row">
        <StatPill value={activeBeds.length} label="Active Beds" to="/plot" />
        <StatPill value={inGround.length} label="In Ground" to="/calendar" />
        <StatPill value={coldFrameEntries.length} label="Cold Frame" to="/cold-frame" />
        <StatPill value={seedStock.length} label="Seed Packets" to="/seeds" />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="dash-alerts">
          {alerts.map((a, i) => <AlertBanner key={i} {...a} />)}
        </div>
      )}

      {/* Main two-column grid */}
      <div className="dash-grid">

        {/* ── Left column ─── */}
        <div className="dash-col">
          <WeatherWidget weather={weather} loading={weatherLoading} error={weatherError} />

          {/* Soil-temp sowability */}
          {sowableByTemp.length > 0 && weather?.soilTemp != null && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card-header">
                <span className="card-title">Sowable now (soil ~{weather.soilTemp}°C)</span>
              </div>
              <div className="card-body">
                <div className="chip-wrap">
                  {sowableByTemp.slice(0, 10).map(c => (
                    <Link key={c.id} to={`/crops/${c.id}`}
                      className="family-badge"
                      style={{ background: getFamilyBgColor(c.family), color: getFamilyColor(c.family) }}
                    >
                      {c.name}
                    </Link>
                  ))}
                  {sowableByTemp.length > 10 && (
                    <span className="text-xs text-muted">+{sowableByTemp.length - 10} more</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sow this month */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card-header">
              <span className="card-title">Sow in {MONTH_NAMES_FULL[currentMonth - 1]}</span>
              <span className="text-xs text-muted">{sowableThisMonth.length} crops</span>
            </div>
            <div className="card-body">
              {sowableThisMonth.length === 0 ? (
                <p className="text-sm text-muted">No crops to sow this month.</p>
              ) : (
                <div className="chip-wrap">
                  {sowableThisMonth.map(c => (
                    <Link key={c.id} to={`/crops/${c.id}`}
                      className="family-badge"
                      style={{ background: getFamilyBgColor(c.family), color: getFamilyColor(c.family) }}
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right column ─── */}
        <div className="dash-col">

          {/* This week's tasks */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">This week's tasks</span>
              {tasks.length > 0 && (
                <span className="badge"
                  style={{ background: 'var(--green-100)', color: 'var(--green-800)' }}>
                  {tasks.length}
                </span>
              )}
            </div>
            <div className="card-body" style={{ padding: tasks.length ? '0' : undefined }}>
              {tasks.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.25rem 0' }}>
                  <div className="empty-state-icon" style={{ fontSize: '1.5rem' }}>✓</div>
                  <div className="empty-state-title" style={{ fontSize: '0.875rem' }}>All clear this week</div>
                  <div className="empty-state-text">
                    {hasAnyData
                      ? 'No scheduled tasks for the next 7 days.'
                      : 'Add beds and plan crops to see tasks here.'}
                  </div>
                </div>
              ) : (
                <ul className="task-list">
                  {tasks.map(t => (
                    <li key={t.id} className="task-item">
                      <span className="task-icon">{t.icon}</span>
                      <div className="task-body">
                        <span className="task-title">{t.title}</span>
                        <span className="task-meta">{t.meta}</span>
                      </div>
                      {t.link && (
                        <Link to={t.link} className="btn btn-ghost btn-sm">View</Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Cold frame summary */}
          {coldFrameEntries.length > 0 && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card-header">
                <span className="card-title">Cold frame</span>
                <Link to="/cold-frame" className="btn btn-secondary btn-sm">Manage</Link>
              </div>
              <ul className="task-list">
                {coldFrameEntries.slice(0, 5).map(e => {
                  const crop = getCropById(e.cropId);
                  const daysOld = e.sowDate ? daysSince(e.sowDate) : null;
                  const stageLabel = {
                    just_sown: 'Just sown',
                    germinated: 'Germinated',
                    growing_on: 'Growing on',
                    ready_to_harden: 'Harden off',
                    hardening_off: 'Hardening off',
                  }[e.stage] || e.stage;
                  const stageClass = {
                    just_sown: 'stage-just-sown',
                    germinated: 'stage-germinated',
                    growing_on: 'stage-growing-on',
                    ready_to_harden: 'stage-ready-to-harden',
                    hardening_off: 'stage-hardening-off',
                  }[e.stage] || '';
                  return (
                    <li key={e.id} className="task-item">
                      <span className="task-icon">🏡</span>
                      <div className="task-body">
                        <span className="task-title">
                          {crop?.name || e.cropId}
                          {e.variety ? ` – ${e.variety}` : ''}
                        </span>
                        <span className="task-meta">
                          {daysOld != null ? `${daysOld}d old` : ''}
                          {daysOld != null ? ' · ' : ''}Sown {formatDateShort(e.sowDate)}
                        </span>
                      </div>
                      <span className={`badge ${stageClass}`}>{stageLabel}</span>
                    </li>
                  );
                })}
                {coldFrameEntries.length > 5 && (
                  <li className="task-item" style={{ justifyContent: 'center', padding: '0.5rem' }}>
                    <Link to="/cold-frame" className="text-sm text-muted">
                      View all {coldFrameEntries.length} entries →
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── In the ground ── */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-header">
          <span className="card-title">In the ground</span>
          <Link to="/calendar" className="btn btn-secondary btn-sm">Manage</Link>
        </div>
        {inGround.length === 0 ? (
          <div className="card-body">
            <div className="empty-state" style={{ padding: '1.25rem 0' }}>
              <div className="empty-state-icon">🌱</div>
              <div className="empty-state-title">Nothing sown yet</div>
              <div className="empty-state-text">
                {beds.length === 0 ? (
                  <><Link to="/plot">Add your beds</Link> then plan what to grow.</>
                ) : (
                  <><Link to="/calendar">Plan your crops</Link> and assign them to beds.</>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div>
            {inGround.map(a => {
              const crop = getCropById(a.cropId);
              const bed = beds.find(b => b.id === a.bedId);
              if (!crop) return null;
              const daysOld = daysSince(a.sowDate);
              const statusLabels = {
                planned: 'Planned', sown: 'Sown', germinated: 'Germinated',
                growing: 'Growing', harvested: 'Harvested',
              };
              return (
                <div key={a.id} className="in-ground-row">
                  <div className="in-ground-bar"
                    style={{ background: getFamilyColor(crop.family) }} />
                  <div className="in-ground-body">
                    <span className="in-ground-name">
                      <Link to={`/crops/${crop.id}`}>{crop.name}</Link>
                      {a.variety && <span className="in-ground-variety"> – {a.variety}</span>}
                    </span>
                    <span className="in-ground-meta">
                      {bed?.name || 'Unassigned'} · sown {daysOld != null ? `${daysOld}d ago` : formatDateShort(a.sowDate)}
                    </span>
                  </div>
                  <span className="badge"
                    style={{
                      background: a.status === 'growing' || a.status === 'germinated'
                        ? 'var(--green-100)' : 'var(--gray-100)',
                      color: a.status === 'growing' || a.status === 'germinated'
                        ? 'var(--green-800)' : 'var(--gray-600)',
                    }}>
                    {statusLabels[a.status] || a.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Getting started guide ── */}
      {!hasAnyData && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-header">
            <span className="card-title">Getting started</span>
          </div>
          <div className="card-body" style={{ padding: '0' }}>
            {[
              { num: '1', to: '/plot', title: 'Set up your beds', desc: 'Create your plot layout with named beds and dimensions.' },
              { num: '2', to: '/crops', title: 'Browse 29 crops', desc: 'Explore pre-seeded UK allotment vegetables with growing guides.' },
              { num: '3', to: '/calendar', title: 'Plan your season', desc: 'Assign crops to beds with sow dates and succession intervals.' },
              { num: '4', to: '/seeds', title: 'Log your seed stock', desc: 'Track packets so the app can warn you about gaps.' },
            ].map(step => (
              <Link key={step.num} to={step.to} className="getting-started-step">
                <span className="getting-started-num">{step.num}</span>
                <div className="getting-started-text">
                  <div className="font-semibold">{step.title}</div>
                  <div className="text-sm text-muted">{step.desc}</div>
                </div>
                <span className="text-muted">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
