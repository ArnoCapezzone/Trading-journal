export type TradeDirection = 'LONG' | 'SHORT';
export type TradeSource = 'MANUAL' | 'MT5_IMPORT';
export type TradeStatus = 'COMPLETE' | 'PENDING_REVIEW';
export type SetupType = 'BREAKOUT' | 'REVERSAL' | 'SUPPORT_RESISTANCE' | 'TREND_FOLLOWING' | 'RANGE' | 'NEWS' | 'OTHER';
export type Timeframe = '1M' | '5M' | '15M' | '30M' | '1H' | '4H' | 'D' | 'W';

export interface Trade {
  id: string;
  source: TradeSource;
  status: TradeStatus;
  createdAt: Date;
  updatedAt: Date;
  instrument: string;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  lotSize: number;
  stopLoss?: number;
  takeProfit?: number;
  commission?: number;
  swap?: number;
  mt5TicketId?: string;
  mt5Profit?: number;       // Raw profit from MT5 broker (excludes commission/swap) — authoritative for MT5 imports
  timeframe?: Timeframe;
  setup?: SetupType;
  notes?: string;
  tags?: string[];
  chartImageBase64?: string;
  accountBalanceAtEntry?: number;
}

export interface TradeFilters {
  instruments: string[];
  direction: 'ALL' | 'LONG' | 'SHORT';
  status: 'ALL' | 'COMPLETE' | 'PENDING_REVIEW';
  setups: SetupType[];
  source: 'ALL' | 'MANUAL' | 'MT5_IMPORT';
  dateFrom?: Date;
  dateTo?: Date;
}

export interface Settings {
  key: string;
  value: unknown;
}
