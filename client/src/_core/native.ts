/**
 * Native Bridge Utility for WebToApp / Capacitor / WebView
 * This allows the Web UI to communicate with the Android/Native layer.
 */

declare global {
  interface Window {
    NativeBridge?: {
      postMessage: (message: string) => void;
    };
    // Additional interfaces for common native wrappers
    webkit?: {
        messageHandlers?: any;
    };
  }
}

class NativeManager {
  /**
   * Checks if the application is running inside a native app shell.
   */
  public get isNative(): boolean {
    return !!window.NativeBridge || !!window.webkit?.messageHandlers || (window as any).Capacitor?.isNative;
  }

  /**
   * Triggers a native message or action if available.
   * @param action The type of action (e.g., 'closeApp', 'share', 'print')
   * @param payload Optional data to send to the native layer
   */
  public sendAction(action: string, payload: any = {}): void {
    if (window.NativeBridge) {
        window.NativeBridge.postMessage(JSON.stringify({ action, ...payload }));
    } else if (window.webkit?.messageHandlers?.NativeBridge) {
        window.webkit.messageHandlers.NativeBridge.postMessage({ action, ...payload });
    } else {
        console.warn("[NativeBridge] No native bridge detected for action:", action);
    }
  }

  /**
   * Helper to vibrate the device (native POS feel)
   */
  public vibrate(): void {
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
  }
}

export const native = new NativeManager();
