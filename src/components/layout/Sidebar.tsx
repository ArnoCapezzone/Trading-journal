import { NavLink } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

const NAV_ITEMS = [
  {
    to: '/',
    end: true,
    label: 'Dashboard',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1" y="1" width="6" height="6" rx="1.5" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/journal',
    end: false,
    label: 'Journal',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" />
        <line x1="5" y1="5.5" x2="11" y2="5.5" />
        <line x1="5" y1="8" x2="11" y2="8" />
        <line x1="5" y1="10.5" x2="8.5" y2="10.5" />
      </svg>
    ),
  },
  {
    to: '/playbooks',
    end: false,
    label: 'Playbooks',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
        <line x1="6" y1="2.5" x2="6" y2="13.5" />
        <line x1="8" y1="5" x2="12" y2="5" />
        <line x1="8" y1="8" x2="12" y2="8" />
        <line x1="8" y1="11" x2="10.5" y2="11" />
      </svg>
    ),
  },
  {
    to: '/daily-plan',
    end: false,
    label: 'Daily Plan',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="12" height="11" rx="1.5" />
        <line x1="2" y1="6.5" x2="14" y2="6.5" />
        <line x1="5" y1="1.5" x2="5" y2="4" />
        <line x1="11" y1="1.5" x2="11" y2="4" />
        <circle cx="5.5" cy="9.5" r="0.6" fill="currentColor" />
        <circle cx="8" cy="9.5" r="0.6" fill="currentColor" />
        <circle cx="10.5" cy="9.5" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    to: '/import',
    end: false,
    label: 'Import',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="8,2.5 8,10" />
        <polyline points="5,7 8,10 11,7" />
        <line x1="2" y1="13" x2="14" y2="13" />
      </svg>
    ),
  },
  {
    to: '/mentor',
    end: false,
    label: 'AI Mentor',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5.5a2 2 0 012-2h6a2 2 0 012 2v4a2 2 0 01-2 2H7l-3 2.5v-2.5H5a2 2 0 01-2-2v-4z" />
        <circle cx="6" cy="7.5" r="0.6" fill="currentColor" />
        <circle cx="10" cy="7.5" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    to: '/analysis',
    end: false,
    label: 'AI Analysis',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="8" cy="8" r="2" />
        <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1" />
      </svg>
    ),
  },
  {
    to: '/prop-firm',
    end: false,
    label: 'Prop Firm',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 14h12M3 14V8M6 14V5M9 14V9M12 14V3" />
        <circle cx="3" cy="8" r="0.8" fill="currentColor" />
        <circle cx="6" cy="5" r="0.8" fill="currentColor" />
        <circle cx="9" cy="9" r="0.8" fill="currentColor" />
        <circle cx="12" cy="3" r="0.8" fill="currentColor" />
      </svg>
    ),
  },
  {
    to: '/settings',
    end: false,
    label: 'Settings',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="8" cy="8" r="2.5" />
        <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.2 3.2l.85.85M11.95 11.95l.85.85M3.2 12.8l.85-.85M11.95 4.05l.85-.85" />
      </svg>
    ),
  },
];

export default function Sidebar({ open = true, onClose }: SidebarProps) {
  const isMobile = useIsMobile();
  const visible = !isMobile || open;

  return (
    <>
      {/* Backdrop for mobile drawer */}
      {isMobile && open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(8,11,18,0.7)',
            backdropFilter: 'blur(2px)',
            zIndex: 49,
          }}
        />
      )}

    <aside
      style={{
        width: 220,
        minWidth: 220,
        backgroundColor: '#070A11',
        borderRight: '1px solid #1A2235',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        zIndex: 50,
        transform: visible ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
        boxShadow: isMobile && open ? '4px 0 24px rgba(0,0,0,0.5)' : 'none',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '18px 20px',
          borderBottom: '1px solid #1A2235',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, #3D8EF0, #5AA0F5)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 700,
            fontSize: 13,
            color: '#fff',
            flexShrink: 0,
            boxShadow: '0 2px 12px rgba(61,142,240,0.3)',
          }}
        >
          TJ
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#EEF0F6', lineHeight: 1.2, letterSpacing: '0.01em' }}>
            Trading
          </div>
          <div style={{ fontSize: 10, color: '#4A5368', lineHeight: 1.2, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Journal</div>
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding: '16px 20px 6px', fontSize: 9, fontWeight: 600, color: '#2E3A52', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        Navigation
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 10px 12px' }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => { if (isMobile && onClose) onClose(); }}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              textDecoration: 'none',
              color: isActive ? '#EEF0F6' : '#8E97AC',
              backgroundColor: isActive ? 'rgba(61,142,240,0.12)' : 'transparent',
              borderRadius: 7,
              borderLeft: isActive ? '2px solid #3D8EF0' : '2px solid transparent',
              marginBottom: 2,
              transition: 'all 0.12s ease',
            })}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              if (!el.classList.contains('active')) {
                el.style.backgroundColor = 'rgba(255,255,255,0.04)';
                el.style.color = '#C8CDD8';
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              if (!el.classList.contains('active')) {
                el.style.backgroundColor = 'transparent';
                el.style.color = '#8E97AC';
              }
            }}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid #1A2235',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: 10, color: '#2E3A52', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em' }}>
          v1.0.0
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#00C47A' }} title="Connected" />
        </div>
      </div>
    </aside>
    </>
  );
}
