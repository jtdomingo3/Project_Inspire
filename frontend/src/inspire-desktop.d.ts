export {};

declare global {
  interface Window {
    inspireDesktop?: {
      apiBase?: string;
      appVersion?: string;
      platform?: string;
    };
  }
}
