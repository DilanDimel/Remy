import { Redirect } from "expo-router";
import { Loading } from "@/components/ui";
import { useConfig } from "./config";
import { gateFor, type Gate } from "./rules";
import { useSession } from "./session";

export const useGate = (): Gate => {
  const { status, me, ws } = useSession();
  const { config } = useConfig();
  return gateFor(status, me, ws, config);
};

const ROUTE: Record<Exclude<Gate, "loading">, string> = { "sign-in": "/sign-in", beta: "/beta", terms: "/terms", setup: "/setup", "not-yet": "/not-yet", tabs: "/" };

/** On a gate screen (sign-in, beta, terms, setup, not yet): once this person is past it, move them on to wherever
 *  they belong now. Returns null when this screen is still the right one. */
export function useGateRedirect(here: Gate) {
  const gate = useGate();
  if (gate === here) return null;
  if (gate === "loading") return <Loading />;
  return <Redirect href={ROUTE[gate] as any} />;
}
/** Where the tabs send someone who isn't through every gate yet. */
export function gateRoute(gate: Gate) { return gate === "loading" ? null : ROUTE[gate]; }
