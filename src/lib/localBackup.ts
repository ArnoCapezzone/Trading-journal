// Local data backup & restore — protects against browser cache clearing

// All localStorage keys used by the app (excluding auth/Supabase tokens)
const LOCAL_KEYS = [
  'tj_settings',
  'tj_goals_v1',
  'tj_playbooks_v1',
  'tj_trade_playbooks_v1',
  'tj_daily_plans_v1',
  'tj_mentor_conversations',
  'tj_economic_cal_cache',
  'tj_accounts_v1',
  'tj_trade_accounts_v1',
  'tj_active_account_v1',
  'tj_theme_preference',
  'tj_mt5_sync_settings_v1',
] as const;

export interface LocalBackup {
  version: number;
  exportedAt: string;
  appVersion: string;
  data: Record<string, unknown>;
}

export function exportLocalData(): LocalBackup {
  const data: Record<string, unknown> = {};
  for (const key of LOCAL_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      data[key] = raw; // keep as-is if not JSON
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    data,
  };
}

export function downloadBackup() {
  const backup = exportLocalData();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `trading-journal-local-backup-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface RestoreResult {
  ok: boolean;
  keysRestored: string[];
  errors: string[];
}

export function restoreLocalData(json: string): RestoreResult {
  const result: RestoreResult = { ok: false, keysRestored: [], errors: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    result.errors.push('Invalid JSON file');
    return result;
  }

  if (!parsed || typeof parsed !== 'object') {
    result.errors.push('Backup format unrecognized');
    return result;
  }

  // Accept both wrapped { data: {...} } format and flat { tj_xxx: ... } format
  const backup = parsed as { data?: Record<string, unknown> } & Record<string, unknown>;
  const source = backup.data && typeof backup.data === 'object' ? backup.data : backup;

  for (const key of LOCAL_KEYS) {
    if (source[key] === undefined) continue;
    try {
      const value = source[key];
      const stringified = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, stringified);
      result.keysRestored.push(key);
    } catch (e) {
      result.errors.push(`Failed to restore ${key}: ${(e as Error).message}`);
    }
  }

  result.ok = result.keysRestored.length > 0;
  return result;
}

export function getLocalDataSummary(): { key: string; label: string; size: number; count: number }[] {
  const labels: Record<string, string> = {
    tj_settings: 'Settings',
    tj_goals_v1: 'Goals',
    tj_playbooks_v1: 'Playbooks',
    tj_trade_playbooks_v1: 'Trade ↔ Playbook map',
    tj_daily_plans_v1: 'Daily Plans',
    tj_mentor_conversations: 'AI Mentor conversations',
    tj_economic_cal_cache: 'Economic Calendar cache',
    tj_accounts_v1: 'Accounts',
    tj_trade_accounts_v1: 'Trade ↔ Account map',
    tj_active_account_v1: 'Active account',
    tj_theme_preference: 'Theme preference',
    tj_mt5_sync_settings_v1: 'MT5 AutoSync settings',
  };

  const summary: { key: string; label: string; size: number; count: number }[] = [];
  for (const key of LOCAL_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    let count = 0;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) count = parsed.length;
      else if (parsed && typeof parsed === 'object') count = Object.keys(parsed).length;
      else count = 1;
    } catch {
      count = 1;
    }
    summary.push({
      key,
      label: labels[key] ?? key,
      size: new Blob([raw]).size,
      count,
    });
  }
  return summary;
}
