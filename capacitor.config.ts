import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nabdh.pos',
  appName: 'Nabdh POS',
  webDir: 'dist/public',
  server: {
    // In production, we should use bundled assets and secure schemes.
    // The cleartext and explicit URL are for local development only.
    androidScheme: process.env.NODE_ENV === 'production' ? 'https' : 'http',
    cleartext: process.env.NODE_ENV !== 'production',
    ...(process.env.VITE_DEV_URL ? { url: process.env.VITE_DEV_URL } : {}),
  },
};

export default config;
