import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gactocat.cfoptrainer',
  appName: 'CFOP Trainer',
  webDir: 'out',
  loggingBehavior: 'none',
  // PackageDescription requires tools 6 for the iOS 18 platform constant.
  experimental: { ios: { spm: { swiftToolsVersion: '6.0' } } },
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
  },
};

export default config;
