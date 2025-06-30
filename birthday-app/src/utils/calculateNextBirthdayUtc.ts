// src/common/utils/calculate-next-birthday-utc.ts
import { toZonedTime } from 'date-fns-tz';

export function calculateNextBirthdayUtc(
  birthday: Date,
  timezone: string,
): Date {
  const now = new Date();
  const thisYear = now.getFullYear();

  // create next birthday this year at 9 AM user local time
  const targetLocal = new Date(
    thisYear,
    birthday.getMonth(),
    birthday.getDate(),
    8,
    6,
    0,
    0, // 09:00:00
  );

  // If birthday this year already passed, move to next year
  if (targetLocal <= now) {
    targetLocal.setFullYear(thisYear + 1);
  }

  // Convert local birthday time to UTC so it can be stored & compared
  const targetUtc = toZonedTime(targetLocal, timezone);

  return targetUtc;
}
