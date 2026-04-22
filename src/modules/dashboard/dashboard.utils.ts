export type RevenueTrendPoint = {
  date: string;
  amount: number;
};

export const toDateKey = (input: Date): string => {
  const year = input.getUTCFullYear();
  const month = String(input.getUTCMonth() + 1).padStart(2, '0');
  const day = String(input.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const buildRevenueTrend = (
  rows: Array<{ createdAt: Date; amount: number }>,
  days: number,
): RevenueTrendPoint[] => {
  const today = new Date();
  const trendMap = new Map<string, number>();

  for (let offset = days - 1; offset >= 0; offset--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - offset);
    trendMap.set(toDateKey(d), 0);
  }

  for (const row of rows) {
    const key = toDateKey(new Date(row.createdAt));
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
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
