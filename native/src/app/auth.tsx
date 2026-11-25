import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Loading } from "@/components/ui";

/** Google/LinkedIn sign-in comes back on remy://auth. The sign-in screen reads that link itself, so this route only
 *  steps back to it (instead of showing "page not found" when the app opens the link). */
export default function AuthReturn() {
  const router = useRouter();
  useEffect(() => { if (router.canGoBack()) router.back(); else router.replace("/"); }, [router]);
  return <Loading />;
}
