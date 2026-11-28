import React from 'react';

/**
 * Hero left illustration: golden chit pot overflowing with rupee-stamped coins,
 * framed by golden laurel leaves and subtle sparkles.
 */
export function ChitPotHeroIllustration() {
  return (
    <svg
      width="104"
      height="92"
      viewBox="0 0 120 106"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0, filter: 'drop-shadow(0 10px 18px rgba(0, 0, 0, 0.28))' }}
    >
      <defs>
        <radialGradient id="chit-pot-glow" cx="50%" cy="48%" r="50%">
          <stop offset="0%" stopColor="#FDE047" stopOpacity="0.55" />
          <stop offset="70%" stopColor="#F59E0B" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="chit-pot-gold" x1="25" y1="36" x2="90" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="32%" stopColor="#F59E0B" />
          <stop offset="75%" stopColor="#B45309" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
        <linearGradient id="chit-pot-rim" x1="34" y1="34" x2="80" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="50%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="chit-coin-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="55%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>
        <linearGradient id="chit-laurel-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>

      {/* Ambient halo behind pot */}
      <circle cx="57" cy="54" r="50" fill="url(#chit-pot-glow)" />

      {/* Left laurel wreath leaves */}
      <g fill="url(#chit-laurel-grad)" opacity="0.92">
        <path d="M23 78C14 72 11 63 14 55C20 60 25 68 23 78Z" />
        <path d="M18 60C11 52 11 42 17 35C22 42 23 51 18 60Z" />
        <path d="M22 42C18 33 21 24 28 19C30 27 28 35 22 42Z" />
      </g>

      {/* Right laurel wreath leaves */}
      <g fill="url(#chit-laurel-grad)" opacity="0.92">
        <path d="M91 78C100 72 103 63 100 55C94 60 89 68 91 78Z" />
        <path d="M96 60C103 52 103 42 97 35C92 42 91 51 96 60Z" />
        <path d="M92 42C96 33 93 24 86 19C84 27 86 35 92 42Z" />
      </g>

      {/* Overflowing gold coins at the top */}
      <ellipse cx="43" cy="34" rx="10" ry="6.5" fill="url(#chit-coin-face)" stroke="#B45309" strokeWidth="1" />
      <ellipse cx="70" cy="34" rx="10" ry="6.5" fill="url(#chit-coin-face)" stroke="#B45309" strokeWidth="1" />
      <ellipse cx="56" cy="27" rx="11.5" ry="7.5" fill="url(#chit-coin-face)" stroke="#B45309" strokeWidth="1.1" />
      <ellipse cx="48" cy="31" rx="9" ry="5.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.9" />
      <ellipse cx="64" cy="30" rx="9" ry="5.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.9" />
      <circle cx="57" cy="23" r="8" fill="url(#chit-coin-face)" stroke="#B45309" strokeWidth="1" />

      {/* Pot body */}
      <path
        d="M35 42C24 49 22 68 29 81C35 91 45 96 57 96C69 96 79 91 85 81C92 68 90 49 79 42H35Z"
        fill="url(#chit-pot-gold)"
      />
      {/* Specular highlight on left shoulder of pot */}
      <path
        d="M36 49C30 56 30 69 35 79"
        stroke="#FEF9C3"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* Pot collar / rim */}
      <rect x="33" y="34" width="48" height="10" rx="5" fill="url(#chit-pot-rim)" stroke="#92400E" strokeWidth="1" />

      {/* Rupee emblem stamped in pot center */}
      <circle cx="57" cy="68" r="14" fill="#78350F" opacity="0.28" />
      <text
        x="57"
        y="74.5"
        textAnchor="middle"
        fill="#FEF3C7"
        fontSize="19"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
      >
        ₹
      </text>

      {/* Foreground coin stacks on bottom-right */}
      <g>
        <ellipse cx="95" cy="91" rx="11" ry="4.5" fill="#B45309" />
        <ellipse cx="95" cy="88.5" rx="11" ry="4.5" fill="url(#chit-coin-face)" stroke="#B45309" strokeWidth="0.8" />
        <ellipse cx="95" cy="85" rx="11" ry="4.5" fill="url(#chit-coin-face)" stroke="#B45309" strokeWidth="0.8" />
        <ellipse cx="106" cy="94" rx="9" ry="3.8" fill="#B45309" />
        <ellipse cx="106" cy="91.5" rx="9" ry="3.8" fill="url(#chit-coin-face)" stroke="#B45309" strokeWidth="0.8" />
      </g>

      {/* Twinkling sparkles */}
      <path d="M29 14L30.5 18L34.5 19.5L30.5 21L29 25L27.5 21L23.5 19.5L27.5 18L29 14Z" fill="#FEF08A" />
      <path d="M88 14L89 17L92 18L89 19L88 22L87 19L84 18L87 17L88 14Z" fill="#FEF9C3" />
      <circle cx="42" cy="14" r="1.8" fill="#FDE047" />
      <circle cx="77" cy="18" r="1.5" fill="#FEF08A" />
    </svg>
  );
}

/**
 * Subtle translucent rising bar-chart silhouette placed behind the hero banner's right side.
 */
export function ChitHeroBarsBg() {
  return (
    <svg
      width="240"
      height="136"
      viewBox="0 0 240 136"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{
        position: 'absolute',
        right: '24px',
        bottom: '-6px',
        pointerEvents: 'none',
        opacity: 0.14,
      }}
    >
      <defs>
        <linearGradient id="chit-hero-bar-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect x="8" y="88" width="24" height="48" rx="6" fill="url(#chit-hero-bar-fade)" />
      <rect x="44" y="72" width="24" height="64" rx="6" fill="url(#chit-hero-bar-fade)" />
      <rect x="80" y="54" width="24" height="82" rx="6" fill="url(#chit-hero-bar-fade)" />
      <rect x="116" y="38" width="24" height="98" rx="6" fill="url(#chit-hero-bar-fade)" />
      <rect x="152" y="22" width="24" height="114" rx="6" fill="url(#chit-hero-bar-fade)" />
      <rect x="188" y="8" width="24" height="128" rx="6" fill="url(#chit-hero-bar-fade)" />
    </svg>
  );
}

const SPARKLINE_PATHS: ReadonlyArray<{ line: string; area: string }> = [
  {
    line: 'M2 34 C18 32, 26 20, 42 22 C58 24, 68 14, 82 15 C92 16, 98 9, 106 6',
    area: 'M2 34 C18 32, 26 20, 42 22 C58 24, 68 14, 82 15 C92 16, 98 9, 106 6 L106 44 L2 44 Z',
  },
  {
    line: 'M2 36 C16 28, 30 30, 46 21 C60 13, 72 24, 86 14 C94 8, 100 10, 106 5',
    area: 'M2 36 C16 28, 30 30, 46 21 C60 13, 72 24, 86 14 C94 8, 100 10, 106 5 L106 44 L2 44 Z',
  },
  {
    line: 'M2 35 C20 35, 32 18, 48 18 C64 18, 72 28, 86 17 C94 11, 100 9, 106 7',
    area: 'M2 35 C20 35, 32 18, 48 18 C64 18, 72 28, 86 17 C94 11, 100 9, 106 7 L106 44 L2 44 Z',
  },
  {
    line: 'M2 37 C18 31, 32 24, 48 25 C64 26, 74 12, 90 12 C98 12, 102 7, 106 4',
    area: 'M2 37 C18 31, 32 24, 48 25 C64 26, 74 12, 90 12 C98 12, 102 7, 106 4 L106 44 L2 44 Z',
  },
];

/**
 * Translucent area-curve sparkline tucked into the bottom-right corner of KPI cards.
 */
export function ChitKpiSparkline({
  color,
  variant,
}: {
  color: string;
  variant: 0 | 1 | 2 | 3;
}) {
  const path = SPARKLINE_PATHS[variant];
  const gradId = `chit-spark-grad-${variant}`;
  return (
    <svg
      width="108"
      height="44"
      viewBox="0 0 108 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{
        position: 'absolute',
        right: '8px',
        bottom: '0px',
        pointerEvents: 'none',
        opacity: 0.72,
      }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={path.area} fill={`url(#${gradId})`} />
      <path
        d={path.line}
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}

/**
 * Empty-state illustration: theme-accented checklist clipboard with green checkmarks,
 * soft botanical leaves, and stacked gold coin piles.
 */
export function ChitEmptyClipboardIllustration() {
  return (
    <svg
      width="156"
      height="124"
      viewBox="0 0 156 124"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ marginBottom: '6px' }}
    >
      <defs>
        <linearGradient id="chit-empty-board" x1="42" y1="16" x2="112" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F1F5F9" />
        </linearGradient>
        <linearGradient id="chit-empty-coin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="55%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>
      </defs>

      {/* Soft ground shadow */}
      <ellipse cx="80" cy="112" rx="54" ry="7" fill="#CBD5E1" opacity="0.35" />

      {/* Left decorative leaves tinted with active tenant theme */}
      <path
        d="M42 98C26 92 20 75 26 60C38 66 46 80 42 98Z"
        fill="var(--primary)"
        opacity="0.32"
      />
      <path
        d="M47 94C35 80 34 62 43 49C53 60 54 78 47 94Z"
        fill="var(--primary-dark)"
        opacity="0.22"
      />

      {/* Clipboard backing & paper */}
      <rect
        x="46"
        y="16"
        width="64"
        height="88"
        rx="11"
        fill="#E2E8F0"
        stroke="#CBD5E1"
        strokeWidth="1.2"
      />
      <rect
        x="51"
        y="22"
        width="54"
        height="76"
        rx="8"
        fill="url(#chit-empty-board)"
        stroke="#E2E8F0"
        strokeWidth="1"
      />

      {/* Clipboard top clamp */}
      <rect x="64" y="10" width="28" height="12" rx="5" fill="var(--primary)" />
      <circle cx="78" cy="16" r="2.2" fill="#FFFFFF" />

      {/* Checklist rows */}
      <rect x="59" y="34" width="14" height="14" rx="4" fill="#DCFCE7" />
      <path d="M62.5 41L65 43.5L70 38.5" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="78" y="37" width="21" height="4" rx="2" fill="#94A3B8" opacity="0.65" />
      <rect x="78" y="43" width="14" height="3" rx="1.5" fill="#CBD5E1" />

      <rect x="59" y="55" width="14" height="14" rx="4" fill="#DCFCE7" />
      <path d="M62.5 62L65 64.5L70 59.5" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="78" y="58" width="21" height="4" rx="2" fill="#94A3B8" opacity="0.65" />
      <rect x="78" y="64" width="16" height="3" rx="1.5" fill="#CBD5E1" />

      <rect x="59" y="76" width="14" height="14" rx="4" fill="var(--primary-light)" stroke="var(--primary)" strokeOpacity="0.3" />
      <rect x="78" y="79" width="18" height="4" rx="2" fill="#CBD5E1" />
      <rect x="78" y="85" width="11" height="3" rx="1.5" fill="#E2E8F0" />

      {/* Right stacked gold coins */}
      <g>
        {/* Tall back stack */}
        <ellipse cx="107" cy="104" rx="12" ry="4.5" fill="#B45309" />
        <rect x="95" y="90" width="24" height="14" fill="#D97706" />
        <ellipse cx="107" cy="100" rx="12" ry="4.5" fill="url(#chit-empty-coin)" stroke="#B45309" strokeWidth="0.7" />
        <ellipse cx="107" cy="96" rx="12" ry="4.5" fill="url(#chit-empty-coin)" stroke="#B45309" strokeWidth="0.7" />
        <ellipse cx="107" cy="92" rx="12" ry="4.5" fill="url(#chit-empty-coin)" stroke="#B45309" strokeWidth="0.7" />
        <ellipse cx="107" cy="88" rx="12" ry="4.5" fill="#FEF08A" stroke="#CA8A04" strokeWidth="0.8" />

        {/* Short front stack */}
        <ellipse cx="123" cy="107" rx="10" ry="3.8" fill="#B45309" />
        <rect x="113" y="99" width="20" height="8" fill="#D97706" />
        <ellipse cx="123" cy="103" rx="10" ry="3.8" fill="url(#chit-empty-coin)" stroke="#B45309" strokeWidth="0.7" />
        <ellipse cx="123" cy="99" rx="10" ry="3.8" fill="#FEF08A" stroke="#CA8A04" strokeWidth="0.8" />
      </g>

      {/* Tiny sparkles */}
      <path d="M122 30L123.5 34L127.5 35.5L123.5 37L122 41L120.5 37L116.5 35.5L120.5 34L122 30Z" fill="#FBBF24" />
      <circle cx="38" cy="36" r="2.2" fill="var(--primary)" opacity="0.45" />
    </svg>
  );
}
