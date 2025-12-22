// Icon synonyms and category icons
export const ICON_SYNONYMS: Record<string, string> = {
  // ...fill with actual icon synonyms from App.tsx...
};

export const categoryIcons: Record<string, string> = {
  // ...fill with actual category icons from App.tsx...
};

export function getEffectIcon(nameOrId: string, type: 'exploit' | 'curse' | 'blessing') {
   const lower = (nameOrId || '').toLowerCase();
   // ...existing logic from App.tsx...
}
