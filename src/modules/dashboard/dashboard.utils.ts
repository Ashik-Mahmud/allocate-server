export type RevenueTrendPoint = {
  date: string;
  amount: number;
};

import { getDateKeyInTimezone, getStartOfDayUtc } from 'src/shared/utils/timezone.util';

export const toDateKey = (input: Date, timezone: string = 'UTC'): string =>
  getDateKeyInTimezone(input, timezone);

export const buildRevenueTrend = (
  rows: Array<{ createdAt: Date; amount: number }>,
  days: number,
  timezone: string = 'UTC',
): RevenueTrendPoint[] => {
  const today = getStartOfDayUtc(new Date(), timezone);
  const trendMap = new Map<string, number>();

  for (let offset = days - 1; offset >= 0; offset--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - offset); // Start from today and go back 'days' number of days
    trendMap.set(toDateKey(d, timezone), 0);
  }

  for (const row of rows) {
    const key = toDateKey(new Date(row.createdAt), timezone);
    if (!trendMap.has(key)) {
      continue;
    }
    trendMap.set(key, Number((trendMap.get(key) || 0) + Number(row.amount || 0)));
  }

  return Array.from(trendMap.entries()).map(([date, amount]) => ({ date, amount }));
};

export const buildPlanDistribution = (
  counts: Array<{ planType: string; count: number }>,
): Array<{ planType: string; count: number; ratio: number }> => {
  const total = counts.reduce((sum, item) => sum + item.count, 0);

  return counts.map((item) => ({
    planType: item.planType,
    count: item.count,
    ratio: total > 0 ? Number((item.count / total).toFixed(4)) : 0,
  }));
};

export const startOfUtcDay = (date: Date): Date =>
  getStartOfDayUtc(date, 'UTC');
