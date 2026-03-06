import { useEffect } from "react";

type RingType = "outgoing" | "incoming" | null;

/**
 * Plays a calm looping ringtone using the Web Audio API.
 *
 * "outgoing" → gentle 440 Hz sine tone: 1.2 s on / 3 s pause (you are calling)
 * "incoming" → two-note chime D5 (587 Hz) + B4 (494 Hz) repeating (someone calling you)
 * null       → silence / stops any active tone
 */
export function useRingtone(type: RingType): void {
  useEffect(() => {
    if (!type) return;

    let alive = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let ctx: AudioContext | null = null;

    const scheduleCycle = () => {
      if (!alive || !ctx) return;
      const now = ctx.currentTime;

      if (type === "outgoing") {
        // Single sine at 440 Hz — ring for 1.2 s then 3 s of silence
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 440;
        osc.connect(env);
        env.connect(ctx.destination);

        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.22, now + 0.04);
        env.gain.setValueAtTime(0.22, now + 1.14);
        env.gain.linearRampToValueAtTime(0, now + 1.2);
        osc.start(now);
        osc.stop(now + 1.25);

        // Total cycle: 1.2 s tone + 3 s pause = 4.2 s
        timerId = setTimeout(scheduleCycle, 4200);
      } else {
        // Two-note chime: D5 (587 Hz) then B4 (494 Hz)
        const note = (freq: number, start: number, dur: number) => {
          const osc = ctx!.createOscillator();
          const env = ctx!.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          osc.connect(env);
          env.connect(ctx!.destination);
          env.gain.setValueAtTime(0, start);
          env.gain.linearRampToValueAtTime(0.25, start + 0.03);
          env.gain.setValueAtTime(0.25, start + dur - 0.05);
          env.gain.linearRampToValueAtTime(0, start + dur);
          osc.start(start);
          osc.stop(start + dur + 0.01);
        };

        note(587, now,        0.35); // D5
        note(494, now + 0.42, 0.35); // B4

        // Total cycle: ~0.8 s tones + 1.4 s pause = 2.2 s
        timerId = setTimeout(scheduleCycle, 2200);
      }
    };

    // AudioContext starts suspended on some browsers until a user gesture;
    // since we're called from within a button-click handler context it resumes fine.
    ctx = new AudioContext();
    scheduleCycle();

    return () => {
      alive = false;
      if (timerId !== null) clearTimeout(timerId);
      ctx?.close();
    };
  }, [type]);
}
