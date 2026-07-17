/** Session + localStorage helpers for product spotlight tours */

export const TOUR_SESSION = {
  FRESH_LOGIN: "onesource_fresh_login",
  START_ACCOUNTING: "onesource_start_accounting_tour",
  START_HR: "onesource_start_hr_tour",
} as const;

export function markFreshLogin() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TOUR_SESSION.FRESH_LOGIN, "1");
}

export function queueAccountingTourIfNeeded(userId: string) {
  if (typeof window === "undefined") return;
  if (isAccountingTourCompleted(userId)) return;
  sessionStorage.setItem(TOUR_SESSION.START_ACCOUNTING, "1");
}

export function consumeAccountingTourStart(): boolean {
  if (typeof window === "undefined") return false;
  const pending = sessionStorage.getItem(TOUR_SESSION.START_ACCOUNTING) === "1";
  if (pending) sessionStorage.removeItem(TOUR_SESSION.START_ACCOUNTING);
  return pending;
}

export function accountingTourStorageKey(userId: string) {
  return `onesource_accounting_tour_completed_${userId}`;
}

export function isAccountingTourCompleted(userId: string) {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(accountingTourStorageKey(userId)) === "1";
}

export function markAccountingTourCompleted(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(accountingTourStorageKey(userId), "1");
}

export function hrTourStorageKey(userId: string) {
  return `onesource_hr_tour_completed_${userId}`;
}

export function queueHrTourIfNeeded(userId: string) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(hrTourStorageKey(userId)) === "1") return;
  sessionStorage.setItem(TOUR_SESSION.START_HR, "1");
}

export function consumeHrTourStart(): boolean {
  if (typeof window === "undefined") return false;
  const pending = sessionStorage.getItem(TOUR_SESSION.START_HR) === "1";
  if (pending) sessionStorage.removeItem(TOUR_SESSION.START_HR);
  return pending;
}

export function markHrTourCompleted(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(hrTourStorageKey(userId), "1");
}
