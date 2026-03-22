import { useCallback } from "react";

/**
 * Hook for playing audio alerts
 * Generates beep sounds using Web Audio API
 */
export function useAudioAlert() {
  const playBeep = useCallback(
    (frequency: number = 800, duration: number = 200, volume: number = 0.3) => {
      try {
        // Create audio context
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Create oscillator and gain nodes
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Set parameters
        oscillator.frequency.value = frequency;
        oscillator.type = "sine";

        // Set volume
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

        // Play sound
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
      } catch (error) {
        console.warn("Audio alert failed:", error);
      }
    },
    []
  );

  const playSuccessBeep = useCallback(() => {
    // Success: two ascending beeps
    playBeep(800, 150, 0.3);
    setTimeout(() => playBeep(1000, 150, 0.3), 200);
  }, [playBeep]);

  const playErrorBeep = useCallback(() => {
    // Error: two descending beeps
    playBeep(600, 200, 0.3);
    setTimeout(() => playBeep(400, 200, 0.3), 250);
  }, [playBeep]);

  const playWarningBeep = useCallback(() => {
    // Warning: single beep
    playBeep(700, 250, 0.3);
  }, [playBeep]);

  const playScanBeep = useCallback(() => {
    // Scan: quick double beep
    playBeep(900, 100, 0.25);
    setTimeout(() => playBeep(900, 100, 0.25), 120);
  }, [playBeep]);

  return {
    playBeep,
    playSuccessBeep,
    playErrorBeep,
    playWarningBeep,
    playScanBeep,
  };
}
