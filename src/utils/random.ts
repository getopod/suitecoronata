// Utility: Seeded RNG and shuffle
export const createSeededRng = (seed: number) => {
   let s = seed >>> 0;
   return () => {
      s = Math.imul(1664525, s) + 1013904223 | 0;
      return ((s >>> 0) / 4294967296);
   };
};

export const shuffleArray = <T,>(arr: T[], rng?: () => number): T[] => {
   const out = arr.slice();
   const r = rng ?? Math.random;
   for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
   }
   return out;
};
