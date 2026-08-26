export type DesktopLicenseSetup = {
  schoolName?: string;
  institutionCode?: string;
  licenseCode?: string;
  plan?: string;
  expiresAt?: string;
  maxDevices?: number | string;
};

declare global {
  type SomDesktopAuthUser = import("../pages/auth/LoginPage").AuthUser;

  interface Window {
    somDesktop?: {
      appName?: string;
      mode?: "development" | "local-trial" | "saas" | string;
      apiUrl?: string;
      licenseServerUrl?: string;
      device?: {
        deviceId?: string;
        deviceName?: string;
        appVersion?: string;
        platform?: string;
        arch?: string;
      };
      licenseSetup?: DesktopLicenseSetup | null;
      saveLicenseSetup?: (
        setup: DesktopLicenseSetup
      ) => Promise<{ ok: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      exportPdf?: (fileName: string) => Promise<{ ok: boolean; filePath?: string; canceled?: boolean; error?: string }>;
    };
    __somSetAuthToken?: (token: string) => void;
    __somSetCurrentUser?: (user: SomDesktopAuthUser | null) => void;
  }
}

export {};
