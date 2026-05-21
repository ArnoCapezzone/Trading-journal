import { useLocation, Link } from 'react-router-dom';
import { useTradesStore } from '../../store/tradesStore';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/journal': 'Journal',
  '/journal/new': 'New Trade',
  '/import': 'Import',
  '/settings': 'Settings',
};

function getTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (pathname.startsWith('/journal/edit/')) return 'Edit Trade';
  if (pathname.startsWith('/journal/')) return 'Trade Detail';
  return 'Trading Journal';
}

export default function TopBar() {
  const location = useLocation();
  const title = getTitle(location.pathname);
  const trades = useTradesStore((s) => s.trades);
  const pendingCount = trades.filter((t) => t.status === 'PENDING_REVIEW').length;

  return (
    <header
      style={{
        height: 56,
        backgroundColor: '#1a1d27',
        borderBottom: '1px solid #2d3148',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: '#e8eaf0',
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
              padding: '3px 10px',
              backgroundColor: 'rgba(255, 154, 60, 0.12)',
              border: '1px solid rgba(255, 154, 60, 0.3)',
              borderRadius: 20,
              textDecoration: 'none',
              fontSize: 11,
              color: '#ff9a3c',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 16,
                height: 16,
                backgroundColor: '#ff9a3c',
                color: '#0f1117',
                borderRadius: '50%',
                fontSize: 10,
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link
          to="/journal/new"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 16px',
            backgroundColor: '#4d9eff',
            color: '#0f1117',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 600,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Trade
        </Link>
      </div>
    </header>
  );
}
