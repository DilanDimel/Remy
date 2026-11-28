import { useHinge } from "expo-hinge";
import { useWindowDimensions } from "react-native";

/** Tabletop: a foldable half-open on a desk, top half up like a screen, bottom half flat (Nov 28, owners first). */
export function useTabletop() {
  const hinge = useHinge(); // null on web, on phones without a hinge, and on app builds from before expo-hinge
  const { width, height } = useWindowDimensions();
  // shortcut: expo-hinge doesn't say which way the fold runs, so a half-open hinge with a wider-than-tall window counts
  // as tabletop (Galaxy Z Fold or Pixel Fold turned sideways and stood up). Check on a real device and the iPhone Duo.
  return !!hinge && hinge.status === "partiallyOpen" && hinge.angle >= 60 && hinge.angle <= 150 && width > height;
}
