import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { getCropById, MONTHS } from '../data/crops';
import { useWeather } from '../hooks/useWeather';

// ── Build the context prompt ──────────────────────────────────────────────────

function buildPrompt({ state, weather, focusCropId, focusBedId, focusColdFrameId, customQuestion }) {
  const { beds, assignments, coldFrameEntries, seedStock } = state;
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const month = new Date().getMonth() + 1;

  const lines = [
    `You are a knowledgeable, friendly allotment advisor. Today is ${today}. The plot is in Sheffield, northern England (latitude 53.4°N). Sheffield has a cool, damp climate — late frosts are possible until mid May, and the growing season runs roughly April to October.`,
    '',
    'Give practical, beginner-friendly advice. Be specific to this plot, this time of year, and Sheffield\'s climate. Keep answers concise — 200–400 words unless the question needs more detail.',
    '',
  ];

  // Weather summary
  if (weather && !weather.error) {
    const w = weather.weather;
    if (w) {
      lines.push('## Current weather (Sheffield, Open-Meteo)');
      lines.push(`- Today: high ${w.today.max !== null ? Math.round(w.today.max) + '°C' : '?'}, low ${w.today.min !== null ? Math.round(w.today.min) + '°C' : '?'}, rain ${w.today.rain.toFixed(1)} mm`);
      lines.push(`- Last 7 days rain: ${w.last7Rain} mm`);
      lines.push(`- Estimated soil temp: ${w.soilTemp !== null ? w.soilTemp + '°C' : 'unknown'}`);
      if (w.frostRisk) lines.push(`- ⚠️ Frost risk in next 7 days (down to ${w.lowestForecastTemp}°C)`);
      if (w.wateringAlert) lines.push(`- ⚠️ Low rainfall — watering likely needed`);
      lines.push('');
    }
  }

  // Plot overview
  const activeBeds = beds.filter(b => b.active);
  lines.push('## Plot layout');
  if (activeBeds.length === 0) {
    lines.push('No beds set up yet.');
  } else {
    activeBeds.forEach(bed => {
      lines.push(`- ${bed.name} (${bed.widthM}×${bed.lengthM} m${bed.notes ? ', ' + bed.notes : ''})`);
    });
  }
  lines.push('');

  // What's in the ground
  const activeAssignments = assignments.filter(a => a.status !== 'harvested');
  lines.push('## Crops currently in the ground');
  if (activeAssignments.length === 0) {
    lines.push('Nothing planted yet.');
  } else {
    activeAssignments.forEach(a => {
      const crop = getCropById(a.cropId);
      const bed  = beds.find(b => b.id === a.bedId);
      const sowAgo = a.sowDate
        ? `sown ${Math.round((Date.now() - new Date(a.sowDate + 'T12:00:00')) / 86400000)}d ago`
        : '';
      lines.push(`- ${crop?.name || a.cropId}${a.variety ? ' (' + a.variety + ')' : ''} in ${bed?.name || 'unknown bed'} — ${a.status}${sowAgo ? ', ' + sowAgo : ''}`);
    });
  }
  lines.push('');

  // Cold frame
  lines.push('## Cold frame at home');
  if (coldFrameEntries.length === 0) {
    lines.push('Nothing in the cold frame currently.');
  } else {
    coldFrameEntries.forEach(e => {
      const crop = getCropById(e.cropId);
      const daysOld = e.sowDate
        ? Math.round((Date.now() - new Date(e.sowDate + 'T12:00:00')) / 86400000) : null;
      const stageLabel = {
        just_sown: 'just sown', germinated: 'germinated',
        growing_on: 'growing on', ready_to_harden: 'ready to harden off',
        hardening_off: 'hardening off',
      }[e.stage] || e.stage;
      lines.push(`- ${crop?.name || e.cropId}${e.variety ? ' (' + e.variety + ')' : ''} — ${stageLabel}${daysOld != null ? ', ' + daysOld + 'd old' : ''}${e.notes ? '. Notes: ' + e.notes : ''}`);
    });
  }
  lines.push('');

  // Seed stock summary
  if (seedStock.length > 0) {
    const low = seedStock.filter(s => s.quantity === 'low');
    lines.push('## Seed stock');
    lines.push(`${seedStock.length} packets on hand.${low.length > 0 ? ' Low: ' + low.map(s => getCropById(s.cropId)?.name || s.cropId).join(', ') + '.' : ''}`);
    lines.push('');
  }

  // Focus: specific crop, bed, or cold frame entry
  if (focusCropId) {
    const crop = getCropById(focusCropId);
    if (crop) {
      lines.push('## The user is asking about this crop specifically');
      lines.push(`**${crop.name}** (${crop.familyCommon})`);
      lines.push(`Sow: ${crop.sowWindowStart ? MONTHS[crop.sowWindowStart - 1] + '–' + MONTHS[crop.sowWindowEnd - 1] : 'n/a'}`);
      lines.push(`Harvest: ${crop.harvestWindowStart ? MONTHS[crop.harvestWindowStart - 1] + '–' + MONTHS[crop.harvestWindowEnd - 1] : 'n/a'}`);
      if (crop.propagationNotes) lines.push(`Growing notes: ${crop.propagationNotes}`);
      if (crop.coldFrameNotes) lines.push(`Cold frame notes: ${crop.coldFrameNotes}`);
      lines.push('');
    }
  }

  if (focusBedId) {
    const bed = beds.find(b => b.id === focusBedId);
    if (bed) {
      lines.push('## The user is asking about this bed specifically');
      lines.push(`**${bed.name}** (${bed.widthM}×${bed.lengthM} m${bed.notes ? ', ' + bed.notes : ''})`);
      const bedCrops = activeAssignments.filter(a => a.bedId === focusBedId);
      if (bedCrops.length > 0) {
        lines.push('Currently contains: ' + bedCrops.map(a => getCropById(a.cropId)?.name || a.cropId).join(', '));
      }
      lines.push('');
    }
  }

  if (focusColdFrameId) {
    const entry = coldFrameEntries.find(e => e.id === focusColdFrameId);
    if (entry) {
      const crop = getCropById(entry.cropId);
      lines.push('## The user is asking about this cold frame entry specifically');
      lines.push(`**${crop?.name || entry.cropId}**${entry.variety ? ' (' + entry.variety + ')' : ''}`);
      lines.push(`Stage: ${entry.stage}, sow date: ${entry.sowDate}`);
      if (entry.notes) lines.push(`Notes: ${entry.notes}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(customQuestion || 'What should I focus on for this plot and time of year? Give me a practical overview of the most important tasks and any warnings or advice.');

  return lines.join('\n');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AiAdvice({ focusCropId, focusBedId, focusColdFrameId, trigger }) {
  const { state } = useApp();
  const weather   = useWeather();

  const [open,     setOpen]     = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]); // { role, content }
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const bottomRef  = useRef(null);

  const apiKey = state.settings?.claudeApiKey;
  const model  = state.settings?.claudeModel || 'claude-sonnet-4-6';

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  async function sendMessage(userQuestion) {
    if (!apiKey) {
      setError('Add your Anthropic API key in Settings to use AI advice.');
      return;
    }
    if (loading) return;

    const userMsg = { role: 'user', content: userQuestion };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setQuestion('');
    setLoading(true);
    setError('');

    // Build the system prompt with plot context for the first message
    const systemPrompt = messages.length === 0
      ? buildPrompt({ state, weather, focusCropId, focusBedId, focusColdFrameId, customQuestion: '' })
        .split('---')[0] // context only, question comes as user message
      : undefined;

    const messagesForApi = messages.length === 0
      ? [{ role: 'user', content: buildPrompt({ state, weather, focusCropId, focusBedId, focusColdFrameId, customQuestion: userQuestion }) }]
      : [...newMessages];

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: messagesForApi,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `API error ${res.status}`);
      }

      const data = await res.json();
      const assistantText = data.content?.[0]?.text || '(No response)';
      setMessages(prev => [...prev, { role: 'assistant', content: assistantText }]);
    } catch (err) {
      setError(err.message);
      // Remove the user message we optimistically added
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    sendMessage(q);
  }

  function handleOpen() {
    setOpen(true);
    if (messages.length === 0 && apiKey) {
      // Auto-send initial context question
      sendMessage('Give me a practical overview of what needs attention on my plot right now, including both the allotment and anything in my cold frame.');
    }
  }

  if (!open) {
    return (
      <button
        className="btn btn-secondary btn-sm ai-advice-trigger"
        onClick={handleOpen}
        title="Ask Claude for advice about this plot"
      >
        {trigger || '🤖 AI advice'}
      </button>
    );
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div>
          <span className="ai-panel-title">🤖 AI Advice</span>
          <span className="text-xs text-muted" style={{ marginLeft: '0.5rem' }}>
            Sheffield · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button>
      </div>

      {!apiKey && (
        <div className="ai-panel-body">
          <div className="alert alert-warning">
            <span className="alert-icon">🔑</span>
            <div className="alert-body">
              <div className="alert-title">API key needed</div>
              <div className="alert-text">
                Add your Anthropic API key in <strong>Settings</strong> to enable AI advice.
              </div>
            </div>
          </div>
        </div>
      )}

      {apiKey && (
        <>
          <div className="ai-messages">
            {messages.length === 0 && !loading && (
              <p className="text-sm text-muted" style={{ padding: '1rem', fontStyle: 'italic' }}>
                Asking Claude about your plot…
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`ai-message ${m.role}`}>
                <div className="ai-message-label">
                  {m.role === 'user' ? 'You' : 'Claude'}
                </div>
                <div className="ai-message-text">
                  {m.content.split('\n').map((line, li) => (
                    <p key={li}>{line || <br />}</p>
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div className="ai-message assistant">
                <div className="ai-message-label">Claude</div>
                <div className="ai-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            {error && (
              <div className="alert alert-danger" style={{ margin: '0.5rem 1rem' }}>
                <span className="alert-icon">⚠️</span>
                <div className="alert-body">
                  <div className="alert-title">Error</div>
                  <div className="alert-text">{error}</div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form className="ai-input-row" onSubmit={handleSubmit}>
            <input
              className="form-control"
              placeholder="Ask a follow-up question…"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !question.trim()}>
              Send
            </button>
          </form>

          <div className="ai-panel-footer">
            <button className="btn btn-ghost btn-sm text-muted"
              onClick={() => setMessages([])}>
              Clear chat
            </button>
            <span className="text-xs text-muted">Powered by {model}</span>
          </div>
        </>
      )}
    </div>
  );
}
