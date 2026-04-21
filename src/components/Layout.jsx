import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/',     label: 'Track', icon: '✅', end: true  },
  { to: '/plot', label: 'Plot',  icon: '🗺️', end: false },
  { to: '/plan', label: 'Plan',  icon: '🌱', end: false },
];

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      {open && (
        <div className="sidebar-overlay visible" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">🌿</span>
          <div>
            <div className="sidebar-logo-text">Allotment Planner</div>
            <div className="sidebar-logo-sub">Sheffield</div>
          </div>
        </div>

        <ul className="nav-list">
          {NAV_ITEMS.map(item => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Settings at the bottom of the sidebar */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--gray-100)', padding: '0.75rem 0' }}>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            onClick={() => setOpen(false)}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Settings</span>
          </NavLink>
        </div>
      </aside>

      {/* Header */}
      <header className="app-header">
        <button className="hamburger" onClick={() => setOpen(o => !o)} aria-label="Menu">
          ☰
        </button>
        <span className="app-header-title">🌿 Allotment Planner</span>
        <NavLink to="/settings" className="btn btn-ghost btn-sm"
          style={{ padding: '4px 8px', marginLeft: 'auto' }}>
          ⚙️
        </NavLink>
      </header>

      {/* Main content */}
      <main className="app-main">{children}</main>

      {/* Mobile bottom nav — 3 tabs + settings */}
      <nav className="bottom-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
        <NavLink
          to="/settings"
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
        >
          <span className="bottom-nav-icon">⚙️</span>
          <span>Settings</span>
        </NavLink>
      </nav>
    </div>
  );
}
