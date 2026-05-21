export default function ClaudeAnalysis() {
  return (
    <div
      style={{
        backgroundColor: '#1a1d27',
        border: '1px solid #2d3148',
        borderRadius: 10,
        padding: '48px 32px',
        textAlign: 'center',
        maxWidth: 600,
        margin: '0 auto',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 20 }}>🤖</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', marginBottom: 12 }}>
        AI Analysis — Coming Soon
      </div>
      <div style={{ fontSize: 13, color: '#8892a4', lineHeight: 1.7, marginBottom: 28 }}>
        In Phase 2, Claude AI will analyze your trading journal and provide:
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, textAlign: 'left', marginBottom: 28 }}>
        {[
          { icon: '📊', title: 'Pattern Recognition', desc: 'Identify your best and worst trading conditions, setups, and times of day' },
          { icon: '🧠', title: 'Behavioral Analysis', desc: 'Detect overtrading, revenge trading, and emotional decision patterns' },
          { icon: '📈', title: 'Setup Optimization', desc: 'Analyze which setups and timeframes consistently generate profit' },
          { icon: '⚡', title: 'Personalized Tips', desc: 'Get actionable, data-driven recommendations specific to your trading style' },
          { icon: '🎯', title: 'Risk Assessment', desc: 'Evaluate position sizing, drawdown patterns, and R:R consistency' },
          { icon: '📝', title: 'Trade Reviews', desc: 'AI-powered post-trade reviews with detailed feedback on execution' },
        ].map((item) => (
          <div
            key={item.title}
            style={{
              backgroundColor: '#0f1117',
              border: '1px solid #2d3148',
              borderRadius: 7,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf0', marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: 11, color: '#8892a4', lineHeight: 1.5 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 20px',
          backgroundColor: 'rgba(77,158,255,0.1)',
          border: '1px solid rgba(77,158,255,0.3)',
          borderRadius: 6,
          fontSize: 12,
          color: '#4d9eff',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4d9eff', display: 'inline-block', animation: 'pulse 2s infinite' }} />
        Phase 2 — Powered by Claude Sonnet API
      </div>
    </div>
  );
}
