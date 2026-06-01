import { useMemo } from 'react';
import { useTradesStore } from '../store/tradesStore';
import { useAccountsStore, filterTradesByAccount } from '../lib/accountsStore';
import type { Trade } from '../types/trade';

/**
 * Returns trades filtered to the currently active account.
 * If activeId === 'all', returns all trades.
 *
 * Use this everywhere instead of `useTradesStore((s) => s.trades)` to
 * automatically scope to the active account.
 */
export function useAccountTrades(): Trade[] {
  const trades = useTradesStore((s) => s.trades);
  const activeId = useAccountsStore((s) => s.activeId);
  const tradeMap = useAccountsStore((s) => s.tradeMap);

  return useMemo(
    () => filterTradesByAccount(trades, activeId, tradeMap),
    [trades, activeId, tradeMap]
  );
}

/**
 * Returns the active account, or null if "all" is selected.
 */
export function useActiveAccount() {
  const activeId = useAccountsStore((s) => s.activeId);
  const accounts = useAccountsStore((s) => s.accounts);
  return useMemo(
    () => (activeId === 'all' ? null : accounts.find((a) => a.id === activeId) ?? null),
    [activeId, accounts]
  );
}
