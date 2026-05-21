# MT5 Export Script

Exports your closed trade history from MetaTrader 5 to JSON format, ready to import into Trading Journal.

## Requirements

- Python 3.9+
- MetaTrader 5 terminal running on Windows (the MT5 Python API only works on Windows)

## Installation

```bash
pip install MetaTrader5
```

## Usage

```bash
# Export last 90 days (default)
python mt5_export.py

# Export last 365 days
python mt5_export.py --days 365

# Custom output file
python mt5_export.py --days 90 --output my_trades.json
```

## Output

The script creates a JSON file (`mt5_trades.json` by default) containing:

```json
{
  "exported_at": "2024-01-15T10:30:00+00:00",
  "from_date": "2023-10-17",
  "to_date": "2024-01-15",
  "count": 142,
  "trades": [
    {
      "ticket": "12345678",
      "symbol": "EURUSD",
      "type": "buy",
      "volume": 0.10,
      "open_time": "2024-01-10 09:15:00",
      "open_price": 1.09250,
      "sl": 1.08900,
      "tp": 1.09800,
      "close_time": "2024-01-10 14:30:00",
      "close_price": 1.09650,
      "swap": 0.0,
      "profit": 40.00,
      "commission": -0.70
    }
  ]
}
```

## Importing into Trading Journal

1. Run the script and note the output file path
2. Open Trading Journal → Import → MT5 Import tab
3. Drag & drop the JSON file (or click to browse)
4. Review the preview table
5. Click "Import X Trades"

## Alternative: CSV Export from MT5 Terminal

If you prefer not to use the Python script:

1. Open MetaTrader 5 terminal
2. Go to **View → Terminal** (Ctrl+T)
3. Click the **History** tab
4. Right-click anywhere → **Save as Report** → choose **Detailed Report**
5. Save as `.htm` — then use the **Account Statement** option for CSV
6. In MT5: **Account History** → right-click → **Save as Report (Detailed)** → select the date range

The CSV format expected:
```
Ticket,Open Time,Type,Size,Symbol,Price,S/L,T/P,Close Time,Close Price,Swap,Profit,Commission
```

## Notes

- The MT5 Python API (`MetaTrader5`) only works on **Windows** with MT5 installed
- MT5 must be running and logged in when you execute the script
- Trades are paired by position ID (handles partial closes)
- All times are exported in UTC
