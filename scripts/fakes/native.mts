// Stand-in for @/lib/native in the checks: whether the store runs as the iOS
// app is a switch the check sets, so one process can try both transports.
export const isNativeApp = () => (globalThis as { __cfopNative?: boolean }).__cfopNative === true;
