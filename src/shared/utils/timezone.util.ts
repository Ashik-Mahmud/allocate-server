type MaybeTimezone = string | null | undefined;

const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'UTC';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_NO_ZONE_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const HAS_TIMEZONE_INFO_REGEX = /(Z|[+-]\d{2}:?\d{2})$/i;

export const isValidTimezone = (timezone?: MaybeTimezone): boolean => {
  if (!timezone) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const resolveTimezone = (...candidates: MaybeTimezone[]): string => {
  for (const candidate of candidates) {
    if (isValidTimezone(candidate)) {
      return candidate as string;
    }
  }

  return isValidTimezone(DEFAULT_TIMEZONE) ? DEFAULT_TIMEZONE : 'UTC';
};

export const resolveUserTimezone = (input?: {
  timezone?: MaybeTimezone;
  organization?: { timezone?: MaybeTimezone } | null;
}): string => {
  return resolveTimezone(input?.timezone, input?.organization?.timezone, DEFAULT_TIMEZONE, 'UTC');
};

const getOffsetMsAtInstant = (instant: Date, timezone: string): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(instant);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  const asUtcFromTimezoneClock = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );

  return asUtcFromTimezoneClock - instant.getTime();
};

const zonedDateTimeToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timezone: string,
): Date => {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const offsetMs = getOffsetMsAtInstant(new Date(utcGuess), timezone);
  return new Date(utcGuess - offsetMs);
};

export const parseDateTimeInTimezone = (
  input: string | Date,
  timezone: string,
): Date => {
  if (input instanceof Date) {
    return new Date(input);
  }

  const resolvedTimezone = resolveTimezone(timezone);

  if (HAS_TIMEZONE_INFO_REGEX.test(input)) {
    return new Date(input);
  }

  if (DATE_ONLY_REGEX.test(input)) {
    const [year, month, day] = input.split('-').map(Number);
    return zonedDateTimeToUtc(year, month, day, 0, 0, 0, 0, resolvedTimezone);
  }

  const dateTimeMatch = input.match(DATE_TIME_NO_ZONE_REGEX);
  if (dateTimeMatch) {
    const [, y, mo, d, h, mi, s = '0', ms = '0'] = dateTimeMatch;
    return zonedDateTimeToUtc(
      Number(y),
      Number(mo),
      Number(d),
      Number(h),
      Number(mi),
      Number(s),
      Number(ms.padEnd(3, '0')),
      resolvedTimezone,
    );
  }

  return new Date(input);
};

const getDatePartsInTimezone = (date: Date, timezone: string) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
};

export const getStartOfDayUtc = (
  dateInput: string | Date,
  timezone: string,
): Date => {
  const resolvedTimezone = resolveTimezone(timezone);

  if (typeof dateInput === 'string' && DATE_ONLY_REGEX.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return zonedDateTimeToUtc(year, month, day, 0, 0, 0, 0, resolvedTimezone);
  }

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const parts = getDatePartsInTimezone(date, resolvedTimezone);
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, 0, resolvedTimezone);
};

export const getEndOfDayUtc = (
  dateInput: string | Date,
  timezone: string,
): Date => {
  const resolvedTimezone = resolveTimezone(timezone);

  if (typeof dateInput === 'string' && DATE_ONLY_REGEX.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return zonedDateTimeToUtc(year, month, day, 23, 59, 59, 999, resolvedTimezone);
  }

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const parts = getDatePartsInTimezone(date, resolvedTimezone);
  return zonedDateTimeToUtc(
    parts.year,
    parts.month,
    parts.day,
    23,
    59,
    59,
    999,
    resolvedTimezone,
  );
};

export const getWeekdayInTimezone = (
  dateInput: string | Date,
  timezone: string,
): string => {
  const resolvedTimezone = resolveTimezone(timezone);
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: resolvedTimezone,
  }).format(date);
};

export const getDateKeyInTimezone = (dateInput: string | Date, timezone: string): string => {
  if (typeof dateInput === 'string' && DATE_ONLY_REGEX.test(dateInput)) {
    return dateInput;
  }

  const resolvedTimezone = resolveTimezone(timezone);
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const parts = getDatePartsInTimezone(date, resolvedTimezone);

  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

export const getMonthKeyInTimezone = (dateInput: string | Date, timezone: string): string => {
  if (typeof dateInput === 'string' && DATE_ONLY_REGEX.test(dateInput)) {
    return dateInput.slice(0, 7);
  }

  const resolvedTimezone = resolveTimezone(timezone);
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const parts = getDatePartsInTimezone(date, resolvedTimezone);

  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
};

export const getWeekKeyInTimezone = (dateInput: string | Date, timezone: string): string => {
  const dateKey = getDateKeyInTimezone(dateInput, timezone);
  const [year, month, day] = dateKey.split('-').map(Number);

  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

export const formatInTimezone = (
  dateInput: string | Date,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
): string => {
  const resolvedTimezone = resolveTimezone(timezone);
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  return new Intl.DateTimeFormat('en-US', {
    timeZone: resolvedTimezone,
    ...options,
  }).format(date);
};
