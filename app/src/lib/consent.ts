// Cookie / analytics consent (E16-S3). Privacy-first: nothing non-essential runs
// until the user opts in. Web-only in practice (the native apps set no cookies);
// on native we treat only essential storage as in use, so there is nothing to
// consent to and analytics stays off until a choice is made.
import { Platform } from 'react-native';

export type ConsentChoice = 'all' | 'essential';
const KEY = 'pbuddy.consent.v1';

function store(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The saved choice, or null if the user hasn't decided yet. */
export function getConsent(): ConsentChoice | null {
  const v = store()?.getItem(KEY);
  return v === 'all' || v === 'essential' ? v : null;
}

export function setConsent(choice: ConsentChoice): void {
  store()?.setItem(KEY, choice);
}

/** Whether non-essential analytics may run. Defaults to false until opted in. */
export function hasAnalyticsConsent(): boolean {
  return getConsent() === 'all';
}
