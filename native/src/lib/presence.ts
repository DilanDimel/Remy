// Team & hours → Using Remy, owners only (server/platform/presence.ts): one beat a minute while the app is open on
// screen, with the screen's address. Students never send anything. Ships with an app update, no store build.
import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { api } from "./api";
import { useSession } from "./session";

export function usePresence() {
  const { me } = useSession();
  const path = usePathname();
  const where = useRef(path);
  where.current = path;
  useEffect(() => {
    if (!me?.owner) return;
    const beat = () => { if (AppState.currentState === "active") api("POST", "/api/team/presence", { device: "app", path: where.current }).catch(() => {}); };
    const t = setInterval(beat, 60_000);
    return () => clearInterval(t);
  }, [me?.owner]);
}
