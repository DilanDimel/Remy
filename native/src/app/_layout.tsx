import { PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, useFonts } from "@expo-google-fonts/plus-jakarta-sans";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { JobsProvider } from "@/lib/jobs";
import { SessionProvider } from "@/lib/session";
import { ThemeProvider, useTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { c, dark } = useTheme();
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
        <Stack.Screen name="not-yet" options={{ animation: "fade" }} />
        {/* Screens not rebuilt natively yet open the website, signed in, as a sheet. */}
        <Stack.Screen name="web" options={{ presentation: "modal", headerShown: true, headerTintColor: c.fox, headerStyle: { backgroundColor: c.surface }, headerTitleStyle: { color: c.ink } }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  const [loaded] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  if (!loaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <JobsProvider>
              <Root />
            </JobsProvider>
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
