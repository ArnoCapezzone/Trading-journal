import { useMemo } from 'react';
import type { Trade } from '../../types/trade';
import {
  calculateRevengeTradingImpact,
  calculateDisciplineScore,
  calculateTiltDays,
  calculateByHour,
  calculateByDayOfWeek,
} from '../../utils/advancedMetrics';

interface Props {
  trades: Trade[];
  accountBalance: number;
  currency: string;
}

function fmtMoney(v: number, c: string) {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)} ${c}`;
}

function fmtHour(h: number) {
  return `${String(h).padStart(2, '0')}:00`;
}

function disciplineColor(score: number) {
  if (score >= 75) return '#00C47A';
  if (score >= 50) return '#F0A030';
  return '#F04848';
}

function tiltColor(score: number) {
  if (score >= 70) return '#F04848';
  if (score >= 40) return '#F0A030';
  return '#00C47A';
}

export default function BehavioralInsights({ trades, accountBalance, currency }: Props) {
  const c = currency === 'EUR' ? '€' : '$';

  const revenge = useMemo(() => calculateRevengeTradingImpact(trades, accountBalance), [trades, accountBalance]);
  const discipline = useMemo(() => calculateDisciplineScore(trades, accountBalance), [trades, accountBalance]);
  const tiltDays = useMemo(() => calculateTiltDays(trades, accountBalance, 5), [trades, accountBalance]);
  const byHour = useMemo(() => calculateByHour(trades, accountBalance), [trades, accountBalance]);
  const byDay = useMemo(() => calculateByDayOfWeek(trades, accountBalance), [trades, accountBalance]);

  // Best/worst hour and day for highlights
  const hoursWithTrades = byHour.filter((h) => h.trades >= 2);
  const bestHour = hoursWithTrades.length > 0
    ? hoursWithTrades.reduce((a, b) => (a.avgPnl > b.avgPnl ? a : b))
    : null;
  const worstHour = hoursWithTrades.length > 0
    ? hoursWithTrades.reduce((a, b) => (a.avgPnl < b.avgPnl ? a : b))
    : null;

  const daysWithTrades = byDay.filter((d) => d.trades >= 2);
  const bestDay = daysWithTrades.length > 0
    ? daysWithTrades.reduce((a, b) => (a.avgPnl > b.avgPnl ? a : b))
    : null;
  const worstDay = daysWithTrades.length > 0
    ? daysWithTrades.reduce((a, b) => (a.avgPnl < b.avgPnl ? a : b))
    : null;

  if (trades.length === 0) return null;

  return (
    <div>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#8B6CF0', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Behavioral Insights
        </div>
        <div style={{ flex: 1, height: 1, backgroundColor: '#181E2C' }} />
        <div style={{ fontSize: 9, color: '#2E3A52', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em' }}>
          AUTO-DETECTED
        </div>
      </div>

      {/* Top row: 4 score cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 12 }}>
        {/* Revenge Trading Impact */}
        <ScoreCard
          title="Revenge-Trading Impact"
          subtitle={revenge.count === 0 ? 'No revenge trades detected' : `${revenge.count} revenge trades · ${revenge.avgGap.toFixed(0)}min avg gap`}
          value={revenge.count === 0 ? '—' : fmtMoney(revenge.netPnl, c)}
          valueColor={revenge.count === 0 ? '#EEF0F6' : revenge.netPnl >= 0 ? '#F0A030' : '#F04848'}
          accentColor={revenge.count === 0 ? '#00C47A' : '#F04848'}
          tooltip="Trades opened within 15min of a loss"
        />

        {/* Discipline Score */}
        <ScoreCard
          title="Discipline Score"
          subtitle={`${discipline.withNotes}/${discipline.totalTrades} with notes · ${discipline.withSetup}/${discipline.totalTrades} tagged`}
          value={`${discipline.score}/100`}
          valueColor={disciplineColor(discipline.score)}
          accentColor={disciplineColor(discipline.score)}
          progress={discipline.score}
          tooltip="Notes + setup + timeframe + consistent sizing + completion"
        />

        {/* Best Hour */}
        <ScoreCard
          title="Most Profitable Hour"
          subtitle={bestHour ? `${bestHour.trades} trades · ${(bestHour.winRate * 100).toFixed(0)}% WR` : 'Need more data'}
          value={bestHour ? fmtHour(bestHour.hour) : '—'}
          subValue={bestHour ? fmtMoney(bestHour.avgPnl, c) + '/trade' : undefined}
          valueColor="#00C47A"
          accentColor="#00C47A"
          tooltip="Hour with highest avg P&L (min 2 trades)"
        />

        {/* Best Day */}
        <ScoreCard
          title="Best Trading Day"
          subtitle={bestDay ? `${bestDay.trades} trades · ${(bestDay.winRate * 100).toFixed(0)}% WR` : 'Need more data'}
          value={bestDay ? bestDay.dayName : '—'}
          subValue={bestDay ? fmtMoney(bestDay.avgPnl, c) + '/trade' : undefined}
          valueColor="#00C47A"
          accentColor="#00C47A"
          tooltip="Day-of-week with highest avg P&L"
        />
      </div>

      {/* Bottom row: tilt days + worst hour/day */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
        {/* High Tilt Days */}
        <div
          style={{
            backgroundColor: '#0D1017',
            border: '1px solid #1E2839',
            borderRadius: 8,
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: '#4A5368', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.10em' }}>
              High-Tilt Days
            </div>
            <div style={{ fontSize: 9, color: '#2E3A52' }}>Top 5 by tilt score</div>
          </div>

          {tiltDays.length === 0 ? (
            <div style={{ fontSize: 12, color: '#8E97AC', textAlign: 'center', padding: '12px 0' }}>
              No significant tilt detected. Keep this up.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tiltDays.map((d) => (
                <div
                  key={d.date}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 1fr 80px 80px 70px',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 11,
                    fontFamily: '"JetBrains Mono", monospace',
                    padding: '5px 8px',
                    borderRadius: 5,
                    backgroundColor: '#080B12',
                  }}
                >
                  <span style={{ color: '#C8CDD8' }}>{d.date}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 4, backgroundColor: '#181E2C', borderRadius: 2, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${d.tiltScore}%`,
                          height: '100%',
                          backgroundColor: tiltColor(d.tiltScore),
                          transition: 'width 0.4s',
                        }}
                      />
                    </div>
                    <span style={{ color: tiltColor(d.tiltScore), fontWeight: 600, minWidth: 30 }}>
                      {d.tiltScore}
                    </span>
                  </div>
                  <span style={{ color: '#8E97AC', textAlign: 'right' }}>{d.trades} trades</span>
                  <span style={{ color: '#8E97AC', textAlign: 'right' }}>{d.consecutiveLosses} L streak</span>
                  <span style={{ color: d.netPnl >= 0 ? '#00C47A' : '#F04848', textAlign: 'right', fontWeight: 600 }}>
                    {fmtMoney(d.netPnl, c).replace(' ' + c, '')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Worst hour + worst day */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CompactCard
            title="Avoid Hour"
            value={worstHour ? fmtHour(worstHour.hour) : '—'}
            sub={worstHour ? `${worstHour.trades} trades · ${fmtMoney(worstHour.avgPnl, c)}/trade` : 'Need data'}
            color="#F04848"
          />
          <CompactCard
            title="Avoid Day"
            value={worstDay ? worstDay.dayName : '—'}
            sub={worstDay ? `${worstDay.trades} trades · ${fmtMoney(worstDay.avgPnl, c)}/trade` : 'Need data'}
            color="#F04848"
          />
        </div>
      </div>
    </div>
  );
}

interface ScoreCardProps {
  title: string;
  subtitle: string;
  value: string;
  subValue?: string;
  valueColor: string;
  accentColor: string;
  progress?: number;
  tooltip?: string;
}

function ScoreCard({ title, subtitle, value, subValue, valueColor, accentColor, progress, tooltip }: ScoreCardProps) {
  return (
    <div
      title={tooltip}
      style={{
        backgroundColor: '#0D1017',
        border: '1px solid #1E2839',
        borderTop: `2px solid ${accentColor}`,
        borderRadius: 8,
        padding: '14px 16px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ fontSize: 10, color: '#4A5368', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.10em' }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div
          style={{
            fontSize: 21,
            fontWeight: 700,
            color: valueColor,
            fontFamily: '"JetBrains Mono", monospace',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </div>
        {subValue && (
          <div style={{ fontSize: 10, color: valueColor, fontFamily: '"JetBrains Mono", monospace', opacity: 0.7 }}>
            {subValue}
          </div>
        )}
      </div>
      {progress !== undefined && (
        <div style={{ height: 3, backgroundColor: '#181E2C', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
          <div style={{ width: `${progress}%`, height: '100%', backgroundColor: accentColor, transition: 'width 0.4s' }} />
        </div>
      )}
      <div style={{ fontSize: 10, color: '#8E97AC', lineHeight: 1.5 }}>{subtitle}</div>
    </div>
  );
}

function CompactCard({ title, value, sub, color }: { title: string; value: string; sub: string; color: string }) {
  return (
    <div
      style={{
        backgroundColor: '#0D1017',
        border: '1px solid #1E2839',
        borderLeft: `2px solid ${color}`,
        borderRadius: 7,
        padding: '10px 12px',
      }}
    >
      <div style={{ fontSize: 9, color: '#4A5368', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: '#8E97AC', lineHeight: 1.4 }}>{sub}</div>
    </div>
  );
}
