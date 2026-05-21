import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  {
    to: '/',
    end: true,
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1" y="1" width="6" height="6" rx="1" />
        <rect x="9" y="1" width="6" height="6" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    to: '/journal',
    end: false,
    label: 'Journal',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <rect x="2" y="1" width="12" height="14" rx="1" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <line x1="5" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1.2" />
        <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.2" />
        <line x1="5" y1="11" x2="9" y2="11" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    to: '/import',
    end: false,
    label: 'Import',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <polyline points="8,2 8,10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <polyline points="5,7 8,10 11,7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="2" y="12" width="12" height="2" rx="1" />
      </svg>
    ),
  },
  {
    to: '/settings',
    end: false,
    label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="8" cy="8" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.2 3.2l0.85 0.85M11.95 11.95l0.85 0.85M3.2 12.8l0.85-0.85M11.95 4.05l0.85-0.85"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        backgroundColor: '#1a1d27',
        borderRight: '1px solid #2d3148',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid #2d3148',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            backgroundColor: '#4d9eff',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 700,
            fontSize: 14,
            color: '#0f1117',
            flexShrink: 0,
          }}
        >
          TJ
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', lineHeight: 1.2 }}>
            Trading
          </div>
          <div style={{ fontSize: 11, color: '#8892a4', lineHeight: 1.2 }}>Journal</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0' }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 24px',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
              color: isActive ? '#4d9eff' : '#8892a4',
              backgroundColor: isActive ? 'rgba(77, 158, 255, 0.08)' : 'transparent',
              borderLeft: isActive ? '2px solid #4d9eff' : '2px solid transparent',
              transition: 'all 0.15s ease',
              marginLeft: 0,
            })}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: '16px 24px',
          borderTop: '1px solid #2d3148',
          fontSize: 11,
          color: '#8892a4',
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        v1.0.0
      </div>
    </aside>
  );
}
