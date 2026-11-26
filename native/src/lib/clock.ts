/** "19:00" moved by `min` minutes, wrapping round the day. */
export const shift = (t: string, min: number) => { const x = (((Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) + min) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };
