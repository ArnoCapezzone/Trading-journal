import { useLocation, Link } from 'react-router-dom';
import { useTradesStore } from '../../store/tradesStore';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface TopBarProps {
  onMenuClick?: () => void;
}

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/journal': 'Journal',
  '/journal/new': 'New Trade',
  '/import': 'Import',
  '/mentor': 'AI Mentor',
  '/analysis': 'AI Analysis',
  '/prop-firm': 'Prop Firm Tools',
  '/daily-plan': 'Daily Plan',
  '/calendar': 'Economic Calendar',
  '/playbooks': 'Strategy Playbooks',
  '/settings': 'Settings',
};

function getTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (pathname.startsWith('/journal/edit/')) return 'Edit Trade';
  if (pathname.startsWith('/journal/')) return 'Trade Detail';
  return 'Trading Journal';
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const location = useLocation();
  const title = getTitle(location.pathname);
  const trades = useTradesStore((s) => s.trades);
  const pendingCount = trades.filter((t) => t.status === 'PENDING_REVIEW').length;
  const isMobile = useIsMobile();

  return (
    <header
      style={{
        height: 52,
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {isMobile && (
          <button
            onClick={onMenuClick}
            aria-label="Open menu"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              padding: '6px 4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        )}
        <h1
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '0.01em',
          }}
        >
          {title}
        </h1>

        {pendingCount > 0 && (
          <Link
            to="/journal?filter=pending"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px 3px 6px',
              backgroundColor: 'rgba(240,160,48,0.10)',
              border: '1px solid rgba(240,160,48,0.25)',
              borderRadius: 20,
              textDecoration: 'none',
              fontSize: 11,
              color: '#F0A030',
              fontWeight: 500,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(240,160,48,0.16)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(240,160,48,0.10)')}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 17,
                height: 17,
                backgroundColor: '#F0A030',
                color: 'var(--text-on-accent)',
                borderRadius: '50%',
                fontSize: 9,
                fontWeight: 700,
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              {pendingCount}
            </span>
            pending review
          </Link>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link
          to="/journal/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            backgroundColor: '#3D8EF0',
            color: '#fff',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.01em',
            transition: 'background 0.15s, box-shadow 0.15s',
            boxShadow: '0 1px 8px rgba(61,142,240,0.2)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#5AA0F5';
            e.currentTarget.style.boxShadow = '0 2px 14px rgba(61,142,240,0.32)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#3D8EF0';
            e.currentTarget.style.boxShadow = '0 1px 8px rgba(61,142,240,0.2)';
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="6" y1="1" x2="6" y2="11" />
            <line x1="1" y1="6" x2="11" y2="6" />
          </svg>
          {isMobile ? '' : 'Add Trade'}
        </Link>
      </div>
    </header>
  );
}
