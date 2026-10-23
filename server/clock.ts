// Demo clock: real time plus an offset the control panel can push forward.
let offsetMs = 0;

export const now = (): Date => new Date(Date.now() + offsetMs);
export const advance = (minutes: number): void => { offsetMs += minutes * 60_000; };
export const resetClock = (): void => { offsetMs = 0; };
