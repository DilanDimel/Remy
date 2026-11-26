import { useSyncExternalStore } from "react";

/** Whether the last call to Remy's server could reach it. `api()` flips it: a call that can't connect marks the phone
 *  offline, and any answer from the server (even an error) marks it online again. No native module needed. */
let offline = false;
const subs = new Set<() => void>();

export function setOffline(next: boolean) {
  if (offline === next) return;
  offline = next;
  subs.forEach((f) => f());
}

export const isOffline = () => offline;

export function useOffline(): boolean {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => offline, () => false);
}
