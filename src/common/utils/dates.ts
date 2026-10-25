import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { TIMEZONE_IST } from '@/config/constants';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTimePlugin);
dayjs.extend(customParseFormat);

export { dayjs };

export function nowIST(): Dayjs {
  return dayjs().tz(TIMEZONE_IST);
}

export function todayIST(): string {
  return nowIST().format('YYYY-MM-DD');
}

export function ymd(date: Date | string | number | Dayjs): string {
  return dayjs(date).tz(TIMEZONE_IST).format('YYYY-MM-DD');
}

export function eachDay(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  let current = dayjs.tz(startDate, TIMEZONE_IST);
  const end = dayjs.tz(endDate, TIMEZONE_IST);

  while (current.isBefore(end) || current.isSame(end, 'day')) {
    days.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }

  return days;
}

export function relativeTime(date: Date | string | number): string {
  return dayjs(date).from(nowIST());
}

export function formatDisplayDate(date: Date | string | number): string {
  return dayjs(date).tz(TIMEZONE_IST).format('D MMM YYYY');
}

export function formatMonthYear(date: Date | string | number): string {
  return dayjs(date).tz(TIMEZONE_IST).format('MMM YYYY');
}

export function formatDateRange(startDate: Date | string, endDate: Date | string): string {
  return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
}

export function parseTolerantDate(input: string | Date | undefined | null): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  const trimmed = input.replace(/^Valid till /i, '').trim();

  const formats = [
    'YYYY-MM-DD',
    'YYYY-MM-DDTHH:mm:ss.SSSZ',
    'YYYY-MM-DDTHH:mm:ssZ',
    'D MMM YYYY',
    'DD MMM YYYY',
    'D MMMM YYYY',
    'DD/MM/YYYY',
    'YYYY/MM/DD',
  ];

  for (const fmt of formats) {
    const parsed = dayjs.tz(trimmed, fmt, TIMEZONE_IST);
    if (parsed.isValid()) {
      return parsed.endOf('day').toDate();
    }
  }

  const standard = dayjs(trimmed);
  if (standard.isValid()) {
    return standard.endOf('day').toDate();
  }

  return null;
}
