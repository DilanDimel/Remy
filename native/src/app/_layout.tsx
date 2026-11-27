import { PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, useFonts } from "@expo-google-fonts/plus-jakarta-sans";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConfigProvider } from "@/lib/config";
import { usePresence } from "@/lib/presence";
import { JobsProvider } from "@/lib/jobs";
import { SessionProvider } from "@/lib/session";
import { ThemeProvider, useTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { c, dark } = useTheme();
  usePresence(); // owners only: Team & hours → Using Remy
  const sheet = { presentation: "modal", headerShown: true, headerTintColor: c.fox, headerStyle: { backgroundColor: c.surface }, headerTitleStyle: { color: c.ink } } as const;
  return (
    <>
      {/* The status bar follows the account's theme (More → Theme), like the website. */}
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
        <Stack.Screen name="auth" options={{ animation: "none" }} />
        <Stack.Screen name="beta" options={{ animation: "fade" }} />
        <Stack.Screen name="terms" options={{ animation: "fade" }} />
        <Stack.Screen name="setup" options={{ animation: "fade" }} />
        <Stack.Screen name="not-yet" options={{ animation: "fade" }} />
        {/* Remy's chat opens over any tab from the floating fox, like the website's Remy panel: a full-height card on
            iPhone (swipe down to close) and a full-screen page on Android. A half-height iOS form sheet (#338) put the
            message box over the messages on a real iPhone, so it's back to the card until that can be tested there. */}
        <Stack.Screen name="remy" options={{ presentation: "modal" }} />
        <Stack.Screen name="round" options={{ presentation: "fullScreenModal" }} />
        <Stack.Screen name="soon" options={{ ...sheet, title: "" }} />
        {/* Screens not rebuilt natively yet open the website, signed in, as a sheet. */}
        <Stack.Screen name="web" options={sheet} />
        <Stack.Screen name="job" options={{ ...sheet, title: "" }} />
        <Stack.Screen name="tailor" options={{ ...sheet, title: "Tailor your resume" }} />
        <Stack.Screen name="news" options={{ ...sheet, title: "What's new" }} />
        <Stack.Screen name="feedback" options={{ ...sheet, title: "Send feedback" }} />
        <Stack.Screen name="rewards" options={{ ...sheet, title: "Rewards" }} />
        <Stack.Screen name="progress" options={{ ...sheet, title: "Progress" }} />
        <Stack.Screen name="calendar" options={{ ...sheet, title: "Calendar" }} />
        <Stack.Screen name="account" options={{ ...sheet, title: "Account" }} />
        <Stack.Screen name="profile" options={{ ...sheet, title: "Edit profile" }} />
        <Stack.Screen name="sources" options={{ ...sheet, title: "Sources" }} />
        <Stack.Screen name="interview" options={{ ...sheet, title: "Interview" }} />
        <Stack.Screen name="prep" options={{ ...sheet, title: "Interview prep" }} />
        <Stack.Screen name="community" options={{ ...sheet, title: "Community" }} />
        <Stack.Screen name="admin" options={{ ...sheet, title: "Owners' dashboard" }} />
        <Stack.Screen name="use" options={{ ...sheet, title: "Using Remy" }} />
        <Stack.Screen name="admin-team" options={{ ...sheet, title: "Board & calendar" }} />
        <Stack.Screen name="admin-system" options={{ ...sheet, title: "System" }} />
        <Stack.Screen name="admin-hours" options={{ ...sheet, title: "Team & hours" }} />
        <Stack.Screen name="admin-openings" options={{ ...sheet, title: "Openings" }} />
        <Stack.Screen name="admin-students" options={{ ...sheet, title: "Students" }} />
        <Stack.Screen name="email" options={{ ...sheet, title: "Email updates" }} />
        <Stack.Screen name="hours" options={{ ...sheet, title: "Hours" }} />
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
        <SessionProvider>
          <ConfigProvider>
            <ThemeProvider>
              <JobsProvider>
                <Root />
              </JobsProvider>
            </ThemeProvider>
          </ConfigProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
