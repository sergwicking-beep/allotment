import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp, useBeds, useActiveAssignments, useColdFrameEntries } from '../store/AppContext';
import { getCropById, getFamilyColor } from '../data/crops';
import { useWeather } from '../hooks/useWeather';

// ── helpers ───────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0];

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function daysUntil(dateStr) {
  return Math.round((new Date(dateStr + 'T12:00:00') - Date.now()) / 86400000);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const TASK_ICONS = { sow: '🌱', check: '👀', plant: '🌿', harvest: '🧺' };

const STATUS_LABELS = {
  planned: 'Planned', sown: 'Sown', germinated: 'Germinated', growing: 'Growing',
};

// ── task builder ──────────────────────────────────────────────────────────────

function buildTasks(beds, assignments, coldFrameEntries) {
  const tasks = [];

  assignments.filter(a => a.status !== 'harvested').forEach(a => {
    const crop = getCropById(a.cropId);
    const bed = beds.find(b => b.id === a.bedId);
    const bedName = bed?.name || '';
    const cropName = `${crop?.name || a.cropId}${a.variety ? ` (${a.variety})` : ''}`;

    // Planned: show sow task within 14 days (incl. overdue)
    if (a.status === 'planned' && a.sowDate) {
      const d = daysUntil(a.sowDate);
      if (d <= 14) {
        tasks.push({
          id: `sow-${a.id}`, type: 'sow', date: a.sowDate, daysUntil: d,
          label: `Sow ${cropName}`, meta: bedName,
          actionType: 'UPDATE_ASSIGNMENT',
          actionPayload: { id: a.id, status: 'sown' },
          actionLabel: 'Mark sown',
        });
      }
    }

    // Sown: show germination check when due (within 5 days)
    if (a.status === 'sown' && a.sowDate && crop?.daysToGermination) {
      const germDate = addDays(a.sowDate, crop.daysToGermination);
      const d = daysUntil(germDate);
      if (d <= 5) {
        tasks.push({
          id: `germ-${a.id}`, type: 'check', date: germDate, daysUntil: d,
          label: `Check ${cropName} for germination`, meta: bedName,
          actionType: 'UPDATE_ASSIGNMENT',
          actionPayload: { id: a.id, status: 'germinated' },
          actionLabel: 'Germinated',
          altActionType: 'UPDATE_ASSIGNMENT',
          altActionPayload: { id: a.id, status: 'failed' },
          altActionLabel: "Didn't germinate",
        });
      }
    }

    // Growing: show harvest reminder within 21 days
    if (a.status === 'growing' && a.expectedHarvestDate) {
      const d = daysUntil(a.expectedHarvestDate);
      if (d <= 21) {
        tasks.push({
          id: `harvest-${a.id}`, type: 'harvest', date: a.expectedHarvestDate, daysUntil: d,
          label: `Harvest ${cropName}`, meta: bedName,
          actionType: 'HARVEST_ASSIGNMENT',
          actionPayload: { id: a.id },
          actionLabel: 'Harvested',
        });
      }
    }
  });

  // Propagation entries
  coldFrameEntries.forEach(e => {
    const crop = getCropById(e.cropId);
    const cropName = crop?.name || e.cropId;

    if (e.stage === 'just_sown' && e.sowDate && crop?.daysToGermination) {
      const germDate = addDays(e.sowDate, crop.daysToGermination);
      const d = daysUntil(germDate);
      if (d <= 5) {
        tasks.push({
          id: `cf-germ-${e.id}`, type: 'check', date: germDate, daysUntil: d,
          label: `Check ${cropName} (indoors) for germination`, meta: 'Propagation',
          actionType: 'UPDATE_COLD_FRAME_ENTRY',
          actionPayload: { id: e.id, stage: 'germinated' },
          actionLabel: 'Germinated',
          altActionType: 'UPDATE_COLD_FRAME_ENTRY',
          altActionPayload: { id: e.id, stage: 'failed_to_germinate' },
          altActionLabel: "Didn't germinate",
        });
      }
    }

    if (e.stage === 'germinated' && e.sowDate) {
      const weeksTarget = crop?.weeksInColdFrame || 6;
      const plantDate = addDays(e.sowDate, weeksTarget * 7);
      const d = daysUntil(plantDate);
      if (d <= 14) {
        tasks.push({
          id: `cf-plant-${e.id}`, type: 'plant', date: plantDate, daysUntil: d,
          label: `Plant out ${cropName}`, meta: 'Propagation',
          actionType: 'DELETE_COLD_FRAME_ENTRY',
          actionPayload: { id: e.id },
          actionLabel: 'Planted out',
        });
      }
    }
  });

  return tasks.sort((a, b) => a.date.localeCompare(b.date));
}

// ── sub-components ────────────────────────────────────────────────────────────

function TaskItem({ task, dispatch }) {
  const overdue = task.daysUntil < 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.75rem 1rem',
      borderBottom: '1px solid var(--gray-100)',
    }}>
      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{TASK_ICONS[task.type] || '•'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: overdue ? '#b91c1c' : 'inherit' }}>
          {task.label}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: '0.1rem' }}>
          {task.meta && <span>{task.meta}</span>}
          {task.meta && <span> · </span>}
          <span style={{ color: overdue ? '#ef4444' : 'inherit' }}>
            {overdue
              ? `${Math.abs(task.daysUntil)}d overdue`
              : task.daysUntil === 0
                ? 'Today'
                : `${formatDate(task.date)} · in ${task.daysUntil}d`}
          </span>
        </div>
      </div>
      {(task.actionLabel || task.altActionLabel) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flexShrink: 0 }}>
          {task.actionLabel && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => dispatch({ type: task.actionType, payload: task.actionPayload })}
            >
              {task.actionLabel}
            </button>
          )}
          {task.altActionLabel && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ whiteSpace: 'nowrap', color: '#b91c1c', fontSize: '0.72rem' }}
              onClick={() => dispatch({ type: task.altActionType, payload: task.altActionPayload })}
            >
              {task.altActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TaskGroup({ title, tasks, dispatch, danger }) {
  if (!tasks.length) return null;
  return (
    <div className="card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
      <div className="card-header"
        style={danger ? { background: '#fef2f2', borderBottom: '1px solid #fecaca' } : {}}>
        <span className="card-title" style={{ color: danger ? '#b91c1c' : undefined }}>
          {danger && '⚠ '}{title}
        </span>
        <span className="text-xs text-muted">{tasks.length}</span>
      </div>
      <div style={{ padding: 0 }}>
        {tasks.map(t => <TaskItem key={t.id} task={t} dispatch={dispatch} />)}
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Track() {
  const { state, dispatch } = useApp();
  const { beds, assignments, coldFrameEntries } = state;
  const { weather } = useWeather();

  const tasks = useMemo(
    () => buildTasks(beds, assignments, coldFrameEntries),
    [beds, assignments, coldFrameEntries]
  );

  const overdue  = tasks.filter(t => t.daysUntil < 0);
  const thisWeek = tasks.filter(t => t.daysUntil >= 0 && t.daysUntil <= 7);
  const comingUp = tasks.filter(t => t.daysUntil > 7);

  const inGround = assignments.filter(a => ['sown', 'germinated', 'growing'].includes(a.status));
  const hasAny   = beds.length > 0 || assignments.length > 0 || coldFrameEntries.length > 0;

  const dateDisplay = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Track</h1>
          <p className="page-subtitle">{dateDisplay}</p>
        </div>
      </div>

      {/* Weather alerts */}
      {weather?.frostRisk && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
          <span className="alert-icon">❄️</span>
          <div className="alert-body">
            <div className="alert-title">Frost risk this week</div>
            <div className="alert-text">Down to {weather.lowestForecastTemp}°C forecast. Protect tender plants.</div>
          </div>
        </div>
      )}
      {weather?.wateringAlert && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
          <span className="alert-icon">💧</span>
          <div className="alert-body">
            <div className="alert-title">Watering needed</div>
            <div className="alert-text">Only {weather.last7Rain} mm in the last 7 days.</div>
          </div>
        </div>
      )}

      {/* Empty / onboarding state */}
      {!hasAny && (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌱</p>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.4rem' }}>Nothing planned yet</h2>
          <p className="text-sm text-muted" style={{ marginBottom: '1.25rem' }}>
            Add your beds, then generate a plan for what you want to grow.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/plot" className="btn btn-secondary">Set up my beds</Link>
            <Link to="/plan" className="btn btn-primary">Plan what to grow</Link>
          </div>
        </div>
      )}

      {/* Tasks */}
      <TaskGroup title="Overdue"   tasks={overdue}  dispatch={dispatch} danger />
      <TaskGroup title="This week" tasks={thisWeek} dispatch={dispatch} />
      <TaskGroup title="Coming up" tasks={comingUp} dispatch={dispatch} />

      {/* All quiet */}
      {hasAny && tasks.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>✓</p>
          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>All quiet</p>
          <p className="text-sm text-muted">No tasks due in the next two weeks.</p>
        </div>
      )}

      {/* In the ground */}
      {inGround.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-header">
            <span className="card-title">In the ground</span>
            <span className="text-xs text-muted">{inGround.length} crop{inGround.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ padding: '0.6rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {inGround.map(a => {
              const crop = getCropById(a.cropId);
              const col  = crop ? getFamilyColor(crop.family) : '#6b7280';
              const bed  = beds.find(b => b.id === a.bedId);
              return (
                <span key={a.id} style={{
                  background: col + '18', color: col,
                  border: `1px solid ${col}44`,
                  borderRadius: '9999px', fontSize: '0.72rem',
                  padding: '3px 10px', fontWeight: 500,
                }}>
                  {crop?.name || a.cropId}
                  {bed ? ` · ${bed.name}` : ''}
                  <span style={{ opacity: 0.65, marginLeft: '4px' }}>
                    ({STATUS_LABELS[a.status]})
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
