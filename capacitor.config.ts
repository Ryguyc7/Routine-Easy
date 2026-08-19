import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ryancrahan.routineeasy",
  appName: "Routine EASY",
  webDir: "mobile-dist",
  ios: {
    backgroundColor: "#fffaf4",
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
};

export default config;
