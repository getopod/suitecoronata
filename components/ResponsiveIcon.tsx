import React, { useState, useEffect } from 'react';
import ADDITIONAL_ICON_SYNONYMS from './iconMappings';

interface ResponsiveIconProps extends React.HTMLAttributes<HTMLElement> {
  name: string; // basename or key, e.g. 'exploits' or 'coin' or category:item (ex: 'blessings:loaner')
  alt?: string;
  size?: number; // displayed size in px (width & height)
  className?: string;
  emojiFallback?: string;
  fallbackType?: 'exploit' | 'curse' | 'blessing' | 'danger' | 'fear';
}

// Small synonyms map for common registry keys vs actual filenames in /public/icons
// Named ICON_SYNONYMS to avoid colliding with other modules that may declare
// a SYNONYMS identifier in the global build scope.
const ICON_SYNONYMS: Record<string, string> = {
  coins: 'coin',
  coin: 'coin',
  fortunes: 'fortune',
  fortune: 'fortune',
  blessings: 'blessing',
  blessing: 'blessing',
  curses: 'curse',
  curse: 'curse',
  hand: 'hand size',
  'hand size': 'hand size',
  shuffle: 'shuffle',
  shuffles: 'shuffle',
  discard: 'discard',
  discards: 'discard',
  exploit: 'exploit',
  exploits: 'exploit',
  danger: 'danger',
  dangers: 'danger',
  fear: 'fear',
  fears: 'fear',
  barricade: 'barricade',
  resign: 'resign',
  orangehelp: 'orangehelp',
  purplehelp: 'purplehelp',
  whitehelp: 'whitehelp',
  notdanger: 'notdanger',
  history: 'run history',
  'run history': 'run history',
  ghost: 'sign in',
  'sign in': 'sign in',
  signin: 'sign in',
  feats: 'feats',
  ascension: 'ascension',
  settings: 'settings',
  setting: 'settings',
  // UI/Menu icons
  back: 'back',
  save: 'save',
  pause: 'pause',
  play: 'play',
  volume: 'volume',
  mute: 'volume',
  sound: 'volume',
  close: 'close',
  exit: 'close',
  feedback: 'feedback',
  glossary: 'glossary',
  login: 'login',
  signup: 'sign up',

  // Registry ID to Filename Mappings (for imported effects)
  bait_switch: 'baitandswitch',
  stolen_valor: 'stolenvalor',
  creative_accounting: 'creativeaccounting',
  martial_law: 'martiallaw',
  path_least_resistance: 'pathofleastresistance',
  gift_gab: 'giftofgab',
  beginners_luck: 'beginnersluck',
  diplomatic_immunity: 'diplomaticimmunity',
  angel_investor: 'angelinvestor',
  bag_of_holding: 'bagofholding',
  street_smarts: 'streetsmarts',
  legitimate_business: 'legitimatebusiness',
  liquid_assets: 'liquidassets',
  fountain_youth: 'fountainofyouth',
  insider_trading: 'insidertrading',
  daruma_karma: 'duarmakarma', // Matches filename typo
  golden_parachute: 'goldenparachute',
  
  // Native Effects Mappings
  alchemist: 'alchemy',
  'fog-of-war': 'fogofwar',
  'moon-toad-cheeks': 'moontoadcheeks',
 };


// Merge-in any additional suggested mappings from a dedicated file. We only
// add keys that aren't already defined in the local `ICON_SYNONYMS` to avoid
// unintended overrides.
for (const [k, v] of Object.entries(ADDITIONAL_ICON_SYNONYMS)) {
  if (!(k in ICON_SYNONYMS)) {
    // Mutate the object so subsequent lookups find the suggested mapping.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - dynamic extension of a const object is intentional here.
    (ICON_SYNONYMS as any)[k] = v;
  }
}

// Map common emoji (used in registries) to canonical icon file basenames
const EMOJI_MAP: Record<string, string> = {};

function slug(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
}

function slugWithUnderscores(s: string) {
  // Match the optimize-icons.mjs safeBaseName function:
  // Replace non-alphanumeric (except - and _) with underscores
  return s.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
}

export default function ResponsiveIcon(props: ResponsiveIconProps) {
  const { name, alt, size = 36, className, emojiFallback, fallbackType, ...rest } = props;
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  // Normalize category names to canonical folder names under /public/icons
  const normalizeCategory = (raw?: string): string | null => {
    if (!raw) return null;
    const k = slug(raw);
    const map: Record<string, string> = {
      fortune: 'fortunes', fortunes: 'fortunes',
      exploit: 'exploits', exploits: 'exploits',
      blessing: 'blessings', blessings: 'blessings',
      curse: 'curses', curses: 'curses',
      fear: 'fears', fears: 'fears',
      danger: 'dangers', dangers: 'dangers',
      resource: 'resources', resources: 'resources',
      menu: 'menus', menus: 'menus',
    };
    return map[k] || null;
  };

  // Convert category folder names to singular forms for /categories/ fallback icons
  const categoryToSingular = (category: string): string => {
    const singularMap: Record<string, string> = {
      'fortunes': 'fortune',
      'exploits': 'exploit',
      'blessings': 'blessing',
      'curses': 'curse',
      'fears': 'fear',
      'dangers': 'danger',
    };
    return singularMap[category] || category;
  };

  // Build candidate list ordered by likelihood
  const buildCandidates = (baseName: string) => {
    const cleaned = String(baseName || '').trim();
    let candidates: string[] = [];
    if (!cleaned) return candidates;
    
    // synonyms override
    const syn = ICON_SYNONYMS[cleaned.toLowerCase()];
    if (syn) candidates.push(syn);
    
    // Try the underscore-based format that matches optimize-icons.mjs output
    const underscoreSlug = slugWithUnderscores(cleaned);
    candidates.push(underscoreSlug);
    
    // Try swapping - and _
    if (underscoreSlug.includes('_')) {
      candidates.push(underscoreSlug.replace(/_/g, '-'));
      // Also try replacing _ with space for files like "above the law.png"
      candidates.push(underscoreSlug.replace(/_/g, ' '));
    }
    if (underscoreSlug.includes('-')) {
      candidates.push(underscoreSlug.replace(/-/g, '_'));
      // Also try replacing - with space
      candidates.push(underscoreSlug.replace(/-/g, ' '));
    }

    // try lower-cased slug forms
    const baseForms = [cleaned, cleaned.replace(/\s+/g, '-'), cleaned.replace(/\s+/g, '_'), cleaned.replace(/\s+/g, '')];
    for (const f of baseForms) {
      const s = slug(f);
      if (!candidates.includes(s)) candidates.push(s);
    }
    
    // also try a lowercase, space-preserving variant to match files like "above the law.png"
    const lowerSpaced = cleaned.toLowerCase();
    if (!candidates.includes(lowerSpaced)) candidates.push(lowerSpaced);

    // also try raw (case-preserving) forms to tolerate case-sensitive hosts with mismatched filenames
    for (const f of baseForms) {
      if (!candidates.includes(f)) candidates.push(f);
    }
    
    return candidates.filter(Boolean);
  };

  // Try loading images in order until one succeeds. Only run in browser (useEffect).
  useEffect(() => {
    let cancelled = false;
  setResolvedSrc(null);
    if (!name) return;
    // Normalize name: strip leading slashes or file extensions
    let nm = String(name || '').trim().replace(/^\//, '').replace(/\.(png|svg)$/i, '');

    // Support category-specific assets via 'category:item' or 'category/item'
    let category: string | null = null;
    let item: string | null = null;
    if (nm.includes(':') || nm.includes('/')) {
      const parts = nm.split(nm.includes(':') ? ':' : '/');
      if (parts.length >= 2) {
        category = normalizeCategory(parts[0]);
        item = parts.slice(1).join('/');
      }
    }

    // If not category-specific and value is an emoji, map it to a known basename
    if (!category) {
      const mapped = EMOJI_MAP[nm];
      if (mapped) nm = mapped;
    }

  const candidates = buildCandidates(item || nm);

  // Compute optimized bucket (choose one of the sizes generated by optimize-icons)
  const deviceDpr = (typeof window !== 'undefined' && (window as any).devicePixelRatio) || 1;
  const desiredPx = Math.ceil(size * deviceDpr);
  const optimizedBucket = desiredPx <= 48 ? 48 : 96;

    const tryLoad = (url: string) => {
      const img = new Image();
      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
      };
      const handleLoad = (resolve: (v: boolean) => void) => () => {
        cleanup();
        resolve(true);
      };
      const handleError = (resolve: (v: boolean) => void) => () => {
        cleanup();
        resolve(false);
      };
      return new Promise<boolean>((resolve) => {
        img.onload = handleLoad(resolve);
        img.onerror = handleError(resolve);
        img.src = url;
      });
    };

    const debug = (...args: any[]) => {
      try {
        if (typeof window !== 'undefined' && ((window as any).__DEBUG_RESPONSIVE_ICON || true)) { // Enable debug
          // eslint-disable-next-line no-console
          console.debug(...args);
        }
      } catch {}
    };

    (async () => {
      // Debug: list candidates (only when explicitly enabled)
      debug('[ResponsiveIcon] name=', name, 'cat=', category, 'item=', item, 'candidates=', candidates);

      // 1) If a category is specified, try category-specific item icons first
      if (category) {
        for (const cand of candidates) {
          // Try optimized webp variant (generated under /icons/optimized/{size}/{name}.webp)
          try {
            const optPath = `/icons/optimized/${optimizedBucket}/${encodeURIComponent(cand)}.webp`;
            debug('[ResponsiveIcon] trying optimized', optPath);
            // eslint-disable-next-line no-await-in-loop
            if (await tryLoad(optPath)) {
              if (cancelled) return;
              debug('[ResponsiveIcon] resolved optimized', optPath);
              setResolvedSrc(optPath);
              return;
            }
          } catch {}

          const pngCat = `/icons/${encodeURIComponent(category)}/${encodeURIComponent(cand)}.png`;
          debug('[ResponsiveIcon] trying', pngCat);
          // eslint-disable-next-line no-await-in-loop
          if (await tryLoad(pngCat)) {
            if (cancelled) return;
            debug('[ResponsiveIcon] resolved', pngCat);
            setResolvedSrc(pngCat);
            return;
          }
        }

        // 2) Category fallback icon (e.g., /icons/categories/blessing.png for blessings category)
        const singularCategory = categoryToSingular(category);
        const catFallbacks = buildCandidates(singularCategory);
        for (const catCand of catFallbacks) {
          // optimized
          try {
            const optPath = `/icons/optimized/${optimizedBucket}/${encodeURIComponent(catCand)}.webp`;
            debug('[ResponsiveIcon] trying optimized', optPath);
            // eslint-disable-next-line no-await-in-loop
            if (await tryLoad(optPath)) {
              if (cancelled) return;
              debug('[ResponsiveIcon] resolved optimized', optPath);
              setResolvedSrc(optPath);
              return;
            }
          } catch {}

          const pngCatFallback = `/icons/categories/${encodeURIComponent(catCand)}.png`;
          debug('[ResponsiveIcon] trying', pngCatFallback);
          // eslint-disable-next-line no-await-in-loop
          if (await tryLoad(pngCatFallback)) {
            if (cancelled) return;
            debug('[ResponsiveIcon] resolved', pngCatFallback);
            setResolvedSrc(pngCatFallback);
            return;
          }
          const svgCatFallback = `/icons/categories/${encodeURIComponent(catCand)}.svg`;
          debug('[ResponsiveIcon] trying', svgCatFallback);
          // eslint-disable-next-line no-await-in-loop
          if (await tryLoad(svgCatFallback)) {
            if (cancelled) return;
            debug('[ResponsiveIcon] resolved', svgCatFallback);
            setResolvedSrc(svgCatFallback);
            return;
          }
        }
      }

      // 3) Generic fallback: try legacy flat icons first (/icons/{name}.png|svg), then optimized webp
      for (const cand of candidates) {
        const pngPath = `/icons/${encodeURIComponent(cand)}.png`;
        debug('[ResponsiveIcon] trying', pngPath);
        // eslint-disable-next-line no-await-in-loop
        if (await tryLoad(pngPath)) {
          if (cancelled) return;
          debug('[ResponsiveIcon] resolved', pngPath);
          setResolvedSrc(pngPath);
          return;
        }

        const svgPath = `/icons/${encodeURIComponent(cand)}.svg`;
        debug('[ResponsiveIcon] trying', svgPath);
        // eslint-disable-next-line no-await-in-loop
        if (await tryLoad(svgPath)) {
          if (cancelled) return;
          debug('[ResponsiveIcon] resolved', svgPath);
          setResolvedSrc(svgPath);
          return;
        }

        try {
          const optPath = `/icons/optimized/${optimizedBucket}/${encodeURIComponent(cand)}.webp`;
          debug('[ResponsiveIcon] trying optimized', optPath);
          // eslint-disable-next-line no-await-in-loop
          if (await tryLoad(optPath)) {
            if (cancelled) return;
            debug('[ResponsiveIcon] resolved optimized', optPath);
            setResolvedSrc(optPath);
            return;
          }
        } catch {}
      }

      // 4) Try common subdirectories: resources, menus
      const commonSubdirs = ['resources', 'menus'];
      for (const subdir of commonSubdirs) {
        for (const cand of candidates) {
          const pngPath = `/icons/${subdir}/${encodeURIComponent(cand)}.png`;
          debug('[ResponsiveIcon] trying', pngPath);
          // eslint-disable-next-line no-await-in-loop
          if (await tryLoad(pngPath)) {
            if (cancelled) return;
            debug('[ResponsiveIcon] resolved', pngPath);
            setResolvedSrc(pngPath);
            return;
          }
          const svgPath = `/icons/${subdir}/${encodeURIComponent(cand)}.svg`;
          debug('[ResponsiveIcon] trying', svgPath);
          // eslint-disable-next-line no-await-in-loop
          if (await tryLoad(svgPath)) {
            if (cancelled) return;
            debug('[ResponsiveIcon] resolved', svgPath);
            setResolvedSrc(svgPath);
            return;
          }
        }
      }

      // 5) Try category icons folder for category names (fortunes→fortune.png, etc.)
      for (const cand of candidates) {
        const pngPath = `/icons/categories/${encodeURIComponent(cand)}.png`;
        debug('[ResponsiveIcon] trying category folder', pngPath);
        // eslint-disable-next-line no-await-in-loop
        if (await tryLoad(pngPath)) {
          if (cancelled) return;
          debug('[ResponsiveIcon] resolved', pngPath);
          setResolvedSrc(pngPath);
          return;
        }
        const svgPath = `/icons/categories/${encodeURIComponent(cand)}.svg`;
        debug('[ResponsiveIcon] trying category folder', svgPath);
        // eslint-disable-next-line no-await-in-loop
        if (await tryLoad(svgPath)) {
          if (cancelled) return;
          debug('[ResponsiveIcon] resolved', svgPath);
          setResolvedSrc(svgPath);
          return;
        }
      }
      
      // 6) Fallback to category icon if provided
      if (fallbackType) {
         const fallbackPath = `/icons/${fallbackType}.png`;
         if (await tryLoad(fallbackPath)) {
            if (cancelled) return;
            setResolvedSrc(fallbackPath);
            return;
         }
      }

      // nothing found -> leave resolvedSrc null (use emoji fallback)
      debug('[ResponsiveIcon] no image found for', name, 'using fallback');
    })();

    return () => { cancelled = true; };
  }, [name, fallbackType]);

  // If we have a resolvedSrc, render the img. Otherwise render emojiFallback or a
  // sensible default emoji so missing icons remain visible in the HUD.
  if (resolvedSrc) {
    return (
      <img
        src={resolvedSrc}
        alt={alt || name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        className={className}
        {...rest}
      />
    );
  }

  // No image found -> render a visible, accessible fallback so missing icons
  // still show something in the HUD (first-letter or emoji). This prevents
  // entirely blank UI elements when an icon file is absent.
  const label = alt || name || '';
  const fallbackText = emojiFallback || (label ? label.charAt(0).toUpperCase() : '?');
  const fallbackStyle: React.CSSProperties = {
    width: size,
    height: size,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a', // slate-900
    color: '#e2e8f0', // slate-200
    borderRadius: Math.max(4, Math.floor(size * 0.15)),
    fontSize: Math.max(10, Math.floor(size * 0.45)),
    lineHeight: 1,
    userSelect: 'none'
  };

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      style={fallbackStyle}
      className={className}
      {...rest}
    >
      <span aria-hidden="true">{fallbackText}</span>
    </div>
  );
}

