#!/usr/bin/env python3
"""
MT5 Export Script — Trading Journal
Connects to MetaTrader 5 and exports closed trade history as JSON.

Usage:
    python mt5_export.py [--days 90] [--output trades.json]
"""

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from typing import Optional

try:
    import MetaTrader5 as mt5
except ImportError:
    print("Error: MetaTrader5 package not found.")
    print("Install it with: pip install MetaTrader5")
    sys.exit(1)


def connect_mt5() -> bool:
    """Initialize connection to MetaTrader 5 terminal."""
    if not mt5.initialize():
        print(f"MT5 initialize() failed, error: {mt5.last_error()}")
        return False
    info = mt5.terminal_info()
    if info is None:
        print("Failed to get terminal info. Is MetaTrader 5 running?")
        mt5.shutdown()
        return False
    print(f"Connected to MT5: {info.name} (build {info.build})")
    account = mt5.account_info()
    if account:
        print(f"Account: {account.login} | Balance: {account.balance:.2f} {account.currency}")
    return True


def get_closed_trades(from_date: datetime, to_date: datetime) -> list[dict]:
    """
    Fetch closed trades from MT5 history.
    Pairs DEAL_ENTRY_IN with DEAL_ENTRY_OUT by position ID.
    """
    # DEAL_ENTRY_IN = 0, DEAL_ENTRY_OUT = 1
    DEAL_ENTRY_IN = 0
    DEAL_ENTRY_OUT = 1
    DEAL_TYPE_BUY = 0
    DEAL_TYPE_SELL = 1

    deals = mt5.history_deals_get(from_date, to_date)
    if deals is None:
        print(f"history_deals_get failed: {mt5.last_error()}")
        return []

    if len(deals) == 0:
        print("No deals found in the specified period.")
        return []

    print(f"Found {len(deals)} deal records")

    # Group deals by position_id
    positions: dict[int, dict] = {}

    for deal in deals:
        pos_id = deal.position_id

        # Skip non-trade deal types (balance, credit, etc.)
        if deal.type not in (DEAL_TYPE_BUY, DEAL_TYPE_SELL):
            continue

        if pos_id not in positions:
            positions[pos_id] = {
                "entry": None,
                "exit": None,
            }

        if deal.entry == DEAL_ENTRY_IN:
            positions[pos_id]["entry"] = deal
        elif deal.entry == DEAL_ENTRY_OUT:
            # If multiple partial closes, accumulate
            if positions[pos_id]["exit"] is None:
                positions[pos_id]["exit"] = deal
            else:
                # Already have an exit — accumulate volume and profit
                existing = positions[pos_id]["exit"]
                # Keep last exit deal but sum the profit
                positions[pos_id]["exit"] = deal
                # Adjust by keeping summed profit
                positions[pos_id]["_extra_profit"] = (
                    positions[pos_id].get("_extra_profit", 0)
                    + existing.profit
                    + existing.swap
                    + existing.commission
                )

    trades_out = []

    for pos_id, pair in positions.items():
        entry = pair["entry"]
        exit_deal = pair["exit"]

        if entry is None or exit_deal is None:
            continue

        # Determine direction from entry deal type
        direction = "LONG" if entry.type == DEAL_TYPE_BUY else "SHORT"

        # Sum up financials
        total_profit = exit_deal.profit + pair.get("_extra_profit", 0)
        total_swap = entry.swap + exit_deal.swap
        total_commission = entry.commission + exit_deal.commission

        trade = {
            "ticket": str(pos_id),
            "symbol": entry.symbol,
            "type": "buy" if direction == "LONG" else "sell",
            "volume": entry.volume,
            "open_time": datetime.fromtimestamp(
                entry.time, tz=timezone.utc
            ).strftime("%Y-%m-%d %H:%M:%S"),
            "open_price": entry.price,
            "sl": 0.0,  # SL not available in deals, need orders
            "tp": 0.0,
            "close_time": datetime.fromtimestamp(
                exit_deal.time, tz=timezone.utc
            ).strftime("%Y-%m-%d %H:%M:%S"),
            "close_price": exit_deal.price,
            "swap": total_swap,
            "profit": total_profit,
            "commission": total_commission,
            "magic": entry.magic,
            "comment": exit_deal.comment or entry.comment,
        }

        # Try to get SL/TP from orders history
        orders = mt5.history_orders_get(position=pos_id)
        if orders:
            for order in orders:
                if order.sl != 0.0:
                    trade["sl"] = order.sl
                if order.tp != 0.0:
                    trade["tp"] = order.tp
                break  # Take from first order

        trades_out.append(trade)

    return trades_out


def export_trades(output_file: str, days: int = 90) -> None:
    """Main export function."""
    to_date = datetime.now(tz=timezone.utc)
    from_date = to_date - timedelta(days=days)

    print(f"Fetching trades from {from_date.strftime('%Y-%m-%d')} to {to_date.strftime('%Y-%m-%d')}")

    trades = get_closed_trades(from_date, to_date)

    if not trades:
        print("No trades to export.")
        return

    # Sort by close time
    trades.sort(key=lambda t: t["close_time"])

    output = {
        "exported_at": datetime.now(tz=timezone.utc).isoformat(),
        "from_date": from_date.strftime("%Y-%m-%d"),
        "to_date": to_date.strftime("%Y-%m-%d"),
        "count": len(trades),
        "trades": trades,
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nExported {len(trades)} trades to {output_file}")

    # Print summary
    winning = sum(1 for t in trades if t["profit"] > 0)
    total_pnl = sum(t["profit"] + t["swap"] + t["commission"] for t in trades)
    print(f"Win rate: {winning}/{len(trades)} ({100*winning/len(trades):.1f}%)")
    print(f"Total P&L: {total_pnl:+.2f}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export MetaTrader 5 trade history to JSON for Trading Journal"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=90,
        help="Number of days of history to export (default: 90)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="mt5_trades.json",
        help="Output JSON file path (default: mt5_trades.json)",
    )
    args = parser.parse_args()

    print("=" * 50)
    print("MT5 Trading Journal Exporter")
    print("=" * 50)

    if not connect_mt5():
        sys.exit(1)

    try:
        export_trades(output_file=args.output, days=args.days)
    finally:
        mt5.shutdown()
        print("\nMT5 connection closed.")


if __name__ == "__main__":
    main()
