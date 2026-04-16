import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import AiAdvice from './AiAdvice';

const NAV_ITEMS = [
  { to: '/',           label: 'Dashboard',    icon: '🌱', end: true  },
  { to: '/plot',       label: 'Plot Layout',  icon: '⬜', end: false },
  { to: '/crops',      label: 'Crop Browser', icon: '🥕', end: false },
  { to: '/calendar',   label: 'Calendar',     icon: '📅', end: false },
  { to: '/rotation',   label: 'Rotation',     icon: '🔄', end: false },
  { to: '/cold-frame', label: 'Cold Frame',   icon: '🏡', end: false },
  { to: '/seeds',      label: 'Seed Stock',   icon: '🌰', end: false },
  { to: '/settings',   label: 'Settings',     icon: '⚙️', end: false },
];

const BOTTOM_NAV = NAV_ITEMS.slice(0, 5);

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      {/* Sidebar overlay (mobile) */}
      {open && (
        <div
          className="sidebar-overlay visible"
          onClick={() => setOpen(false)}
        />
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
      </aside>

      {/* Header */}
      <header className="app-header">
        <button className="hamburger" onClick={() => setOpen(o => !o)} aria-label="Menu">
          ☰
        </button>
        <span className="app-header-title">🌿 Sheffield Allotment Planner</span>
      </header>

      {/* Main content */}
      <main className="app-main">{children}</main>

      {/* Global AI advice button (floating) */}
      <AiAdvice />

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {BOTTOM_NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span>{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
        <button className="bottom-nav-item" onClick={() => setOpen(true)}>
          <span className="bottom-nav-icon">⋯</span>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
