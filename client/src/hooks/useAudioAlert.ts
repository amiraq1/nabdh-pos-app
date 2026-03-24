import { useCallback, useEffect, useRef } from "react";

/**
 * Hook for playing audio alerts
 * Reuses a single Web Audio context to avoid device/render churn.
 */
export function useAudioAlert() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDisabledRef = useRef(false);

  const getAudioContext = useCallback(async () => {
    if (audioDisabledRef.current) {
      return null;
    }

    const AudioContextCtor =
      window.AudioContext || (window as any).webkitAudioContext;

    if (!AudioContextCtor) {
      audioDisabledRef.current = true;
      return null;
    }

    try {
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioContextCtor();
      }

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      return audioContextRef.current;
    } catch (error) {
      audioDisabledRef.current = true;
      console.warn("Audio alert setup failed:", error);
      return null;
    }
  }, []);

  const playBeep = useCallback(
    (frequency: number = 800, duration: number = 200, volume: number = 0.3) => {
      void (async () => {
        const audioContext = await getAudioContext();
        if (!audioContext) {
          return;
        }

        try {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.value = frequency;
          oscillator.type = "sine";

          gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + duration / 1000
          );

          oscillator.onended = () => {
            oscillator.disconnect();
            gainNode.disconnect();
          };

          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration / 1000);
        } catch (error) {
          audioDisabledRef.current = true;
          console.warn("Audio alert failed:", error);

          try {
            await audioContext.close();
          } catch {
            // Ignore close errors after renderer/device failures.
          }

          if (audioContextRef.current === audioContext) {
            audioContextRef.current = null;
          }
        }
      })();
    },
    [getAudioContext]
  );

  const playSuccessBeep = useCallback(() => {
    playBeep(800, 150, 0.3);
    setTimeout(() => playBeep(1000, 150, 0.3), 200);
  }, [playBeep]);

  const playErrorBeep = useCallback(() => {
    playBeep(600, 200, 0.3);
    setTimeout(() => playBeep(400, 200, 0.3), 250);
  }, [playBeep]);

  const playWarningBeep = useCallback(() => {
    playBeep(700, 250, 0.3);
  }, [playBeep]);

  const playScanBeep = useCallback(() => {
    playBeep(900, 100, 0.25);
    setTimeout(() => playBeep(900, 100, 0.25), 120);
  }, [playBeep]);

  useEffect(() => {
    return () => {
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        return;
      }

      void audioContextRef.current.close();
      audioContextRef.current = null;
    };
  }, []);

  return {
    playBeep,
    playSuccessBeep,
    playErrorBeep,
    playWarningBeep,
    playScanBeep,
  };
}
