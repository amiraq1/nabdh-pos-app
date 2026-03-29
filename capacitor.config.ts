import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nabdh.pos',
  appName: 'Nabdh POS',
  webDir: 'dist/public',
  server: {
    androidScheme: 'http',
    cleartext: true,
    url: 'http://10.174.56.53:5173',
  },
};

export default config;
