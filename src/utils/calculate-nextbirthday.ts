import { fromZonedTime } from 'date-fns-tz';

/**
 * Calculates the next birthday in UTC.
 *
 * The birthday email should be sent at 9:00 AM in the user's local timezone.
 * This function converts that local time to UTC for storage and comparison.
 *
 * @param birthDate - User's birth date (only month and day are used)
 * @param timezone - User's IANA timezone (e.g., 'Asia/Jakarta', 'America/New_York')
 * @returns Next birthday date/time in UTC
 *
 * @example
 * // User in Jakarta (UTC+7), birthday Jan 5
 * // Local: 2026-01-05 09:00:00
 * // UTC:   2026-01-05 02:00:00
 * calculateNextBirthdayUtc(new Date('1990-01-05'), 'Asia/Jakarta')
 */
export function calculateNextBirthdayUtc(
  birthDate: Date,
  timezone: string,
): Date {
  const now = new Date();
  const thisYear = now.getFullYear();

  // Create birthday this year at 9 AM in user's local timezone
  // Note: This creates a "wall clock" time, not yet converted to UTC
  const birthdayLocalTime = new Date(
    thisYear,
    birthDate.getMonth(),
    birthDate.getDate(),
    11,
    0,
    0,
    0, // 09:00:00 local time
  );

  // Convert local time → UTC
  // fromZonedTime: "This time in {timezone} is what time in UTC?"
  let birthdayUtc = fromZonedTime(birthdayLocalTime, timezone);

  // If birthday this year already passed, move to next year
  if (birthdayUtc <= now) {
    birthdayLocalTime.setFullYear(thisYear + 1);
    birthdayUtc = fromZonedTime(birthdayLocalTime, timezone);
  }

  return birthdayUtc;
}
