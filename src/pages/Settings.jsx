import React, { useState, useRef } from 'react';
import { useApp, useSettings, exportData } from '../store/AppContext';

export default function Settings() {
  const { state, dispatch } = useApp();
  const settings = useSettings();
  const fileRef  = useRef(null);

  const [apiKey, setApiKey] = useState(settings.claudeApiKey || '');
  const [model,  setModel]  = useState(settings.claudeModel  || 'claude-sonnet-4-6');
  const [saved,  setSaved]  = useState(false);
  const [importError, setImportError] = useState('');

  function handleSave(e) {
    e.preventDefault();
    dispatch({ type: 'UPDATE_SETTINGS', payload: { claudeApiKey: apiKey.trim(), claudeModel: model } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleExport() {
    exportData(state);
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data || typeof data !== 'object') throw new Error('Not a valid JSON object');
        if (window.confirm(
          'This will REPLACE all your current data (beds, crops, history, seed stock, cold frame). Are you sure?'
        )) {
          dispatch({ type: 'IMPORT_DATA', payload: data });
        }
      } catch (err) {
        setImportError(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleClearAll() {
    if (window.confirm(
      'Delete ALL data (beds, assignments, cold frame, seed stock, history)? This cannot be undone.'
    )) {
      if (window.confirm('Are you absolutely sure? All data will be lost.')) {
        dispatch({ type: 'IMPORT_DATA', payload: {} });
      }
    }
  }

  const stats = {
    beds:        state.beds.length,
    assignments: state.assignments.length,
    coldFrame:   state.coldFrameEntries.length,
    seeds:       state.seedStock.length,
    history:     state.history.length,
  };

  const CLAUDE_MODELS = [
    { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6 (recommended)' },
    { id: 'claude-opus-4-6',            label: 'Claude Opus 4.6 (most capable)'  },
    { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5 (fastest)'      },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">AI advice, data export, and app preferences</p>
        </div>
      </div>

      {/* Claude API */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <span className="card-title">Claude AI advice</span>
        </div>
        <div className="card-body">
          <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
            <span className="alert-icon">🤖</span>
            <div className="alert-body">
              <div className="alert-title">AI advice panel</div>
              <div className="alert-text">
                Enter your Anthropic API key to enable the AI advice panel. The app will send your
                plot data, weather summary, and crop context to Claude for personalised growing advice.
                Your key is stored only in your browser's localStorage — never sent to any server other than Anthropic.
              </div>
            </div>
          </div>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Anthropic API key</label>
              <input className="form-control" type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-…" />
              <p className="form-hint">
                Get a key at console.anthropic.com. Leave blank to disable AI advice.
              </p>
            </div>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Model</label>
              <select className="form-control" value={model}
                onChange={e => setModel(e.target.value)}>
                {CLAUDE_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">
              {saved ? '✓ Saved' : 'Save API settings'}
            </button>
          </form>
        </div>
      </div>

      {/* Data summary */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <span className="card-title">Your data</span>
        </div>
        <div className="card-body">
          <div className="dash-stats-row" style={{ marginBottom: '1.25rem' }}>
            {Object.entries(stats).map(([k, v]) => (
              <div key={k} className="dash-stat" style={{ minWidth: 80 }}>
                <span className="dash-stat-value">{v}</span>
                <span className="dash-stat-label">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted" style={{ marginBottom: '1rem' }}>
            All data is stored in your browser's localStorage under the key <code>allotment_v1</code>.
            Export regularly to keep a backup.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-primary btn-sm" onClick={handleExport}>
              ↓ Export backup (JSON)
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              ↑ Import backup
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json"
              style={{ display: 'none' }} onChange={handleImport} />
          </div>
          {importError && (
            <p className="text-sm text-danger" style={{ marginTop: '0.5rem' }}>{importError}</p>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="card" style={{ borderColor: 'var(--red)' }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--red-bg)' }}>
          <span className="card-title text-danger">Danger zone</span>
        </div>
        <div className="card-body">
          <p className="text-sm text-muted" style={{ marginBottom: '1rem' }}>
            This will permanently delete all your beds, crop plans, cold frame entries, seed stock, and harvest history from localStorage.
          </p>
          <button className="btn btn-danger btn-sm" onClick={handleClearAll}>
            Clear all data
          </button>
        </div>
      </div>
    </div>
  );
}
