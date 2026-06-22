// Illustrations et icônes SVG inline pour la landing page.
// Palette : bleu nuit #0F172A, ardoise #1E293B, bleu électrique #3B82F6, blanc.
// Toutes responsive (viewBox + w-full/h-auto), sans dépendance externe.

type IconProps = { className?: string }

// ── Icônes des cartes fonctionnalités (trait, hérite de currentColor) ────────

function Icon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconScan({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function IconZones({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m9 4-5 2v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </Icon>
  )
}

export function IconBell({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Icon>
  )
}

export function IconChart({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="5" rx="0.5" />
      <rect x="12" y="8" width="3" height="9" rx="0.5" />
      <rect x="17" y="5" width="3" height="12" rx="0.5" />
    </Icon>
  )
}

export function IconQr({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3z" />
      <path d="M20 14v7M14 20h7" />
    </Icon>
  )
}

export function IconShield({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  )
}

// ── Décor : grille « blueprint » subtile en arrière-plan ─────────────────────

export function BlueprintGrid({ className }: IconProps) {
  return (
    <svg className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="bp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#3B82F6" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bp-grid)" />
    </svg>
  )
}

// ── Illustration Hero : site industriel + badge d'accès ──────────────────────

export function HeroIllustration({ className }: IconProps) {
  return (
    <svg viewBox="0 0 440 380" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="hero-card" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1E293B" />
          <stop offset="1" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="hero-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <radialGradient id="hero-glow" cx="50%" cy="42%" r="60%">
          <stop offset="0" stopColor="#3B82F6" stopOpacity="0.28" />
          <stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="220" cy="175" rx="205" ry="165" fill="url(#hero-glow)" />

      {/* anneaux décoratifs */}
      <circle cx="220" cy="180" r="150" stroke="#3B82F6" strokeOpacity="0.12" />
      <circle cx="220" cy="180" r="110" stroke="#3B82F6" strokeOpacity="0.18" strokeDasharray="4 6" />

      {/* sol */}
      <line x1="40" y1="312" x2="400" y2="312" stroke="#334155" strokeWidth="2" />

      {/* usine */}
      <g stroke="#3B82F6" strokeWidth="2" strokeLinejoin="round">
        <rect x="64" y="196" width="150" height="116" rx="6" fill="url(#hero-card)" />
        {/* toit en dents de scie */}
        <path d="M64 196l24-26 0 26M112 196l24-26 0 26M160 196l24-26 0 26" fill="url(#hero-card)" />
        {/* cheminée */}
        <rect x="176" y="150" width="22" height="46" rx="3" fill="url(#hero-card)" />
        {/* porte */}
        <rect x="120" y="262" width="34" height="50" rx="2" fill="#0F172A" />
      </g>
      {/* fenêtres accent */}
      <g fill="#3B82F6">
        <rect x="80" y="214" width="18" height="14" rx="2" opacity="0.85" />
        <rect x="106" y="214" width="18" height="14" rx="2" opacity="0.55" />
        <rect x="80" y="236" width="18" height="14" rx="2" opacity="0.45" />
      </g>

      {/* barrière d'accès / tourniquet */}
      <g stroke="#475569" strokeWidth="2" strokeLinecap="round">
        <line x1="232" y1="312" x2="232" y2="250" />
        <line x1="232" y1="258" x2="300" y2="258" stroke="#3B82F6" />
        <circle cx="232" cy="248" r="5" fill="#0F172A" stroke="#3B82F6" />
      </g>

      {/* badge flottant */}
      <g>
        <rect x="262" y="96" width="138" height="172" rx="16" fill="url(#hero-card)" stroke="#3B82F6" strokeWidth="2" />
        {/* attache */}
        <rect x="318" y="86" width="26" height="14" rx="3" fill="#1E293B" stroke="#3B82F6" strokeWidth="2" />
        {/* photo */}
        <circle cx="296" cy="140" r="20" fill="url(#hero-accent)" />
        <circle cx="296" cy="133" r="7" fill="#0F172A" opacity="0.55" />
        <path d="M284 152a12 12 0 0 1 24 0" fill="#0F172A" opacity="0.55" />
        {/* lignes texte */}
        <rect x="326" y="128" width="56" height="8" rx="4" fill="#334155" />
        <rect x="326" y="144" width="40" height="8" rx="4" fill="#334155" />
        {/* QR */}
        <g fill="#3B82F6">
          <rect x="282" y="178" width="14" height="14" rx="2" />
          <rect x="346" y="178" width="14" height="14" rx="2" />
          <rect x="282" y="222" width="14" height="14" rx="2" />
          <rect x="306" y="178" width="8" height="8" rx="1" opacity="0.6" />
          <rect x="324" y="190" width="8" height="8" rx="1" opacity="0.6" />
          <rect x="346" y="206" width="14" height="8" rx="1" opacity="0.6" />
          <rect x="306" y="216" width="8" height="8" rx="1" opacity="0.6" />
          <rect x="324" y="226" width="10" height="10" rx="1" opacity="0.6" />
        </g>
        {/* pastille validée */}
        <circle cx="388" cy="104" r="17" fill="#22C55E" />
        <path d="m381 104 5 5 9-9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  )
}

// ── Illustration « Avant » : registre papier / classeur ──────────────────────

export function PaperStackIllustration({ className }: IconProps) {
  return (
    <svg viewBox="0 0 200 150" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* feuilles éparses (ternes) */}
      <g stroke="#475569" strokeWidth="2" strokeLinejoin="round">
        <rect x="34" y="44" width="96" height="74" rx="4" fill="#1E293B" transform="rotate(-7 82 81)" />
        <rect x="52" y="38" width="96" height="74" rx="4" fill="#293548" transform="rotate(4 100 75)" />
        <rect x="62" y="48" width="96" height="74" rx="4" fill="#334155" />
      </g>
      {/* lignes d'écriture */}
      <g stroke="#64748B" strokeWidth="2" strokeLinecap="round">
        <line x1="74" y1="66" x2="146" y2="66" />
        <line x1="74" y1="80" x2="146" y2="80" />
        <line x1="74" y1="94" x2="124" y2="94" />
      </g>
      {/* coin corné */}
      <path d="M158 48v18h-18" stroke="#64748B" strokeWidth="2" fill="none" strokeLinejoin="round" />
      {/* croix d'erreur */}
      <circle cx="150" cy="36" r="15" fill="#EF4444" />
      <path d="m144 30 12 12M156 30l-12 12" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

// ── Illustration « Après » : badge QR sur smartphone ─────────────────────────

export function QrPhoneIllustration({ className }: IconProps) {
  return (
    <svg viewBox="0 0 200 150" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="phone-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1E293B" />
          <stop offset="1" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      {/* halo */}
      <circle cx="100" cy="75" r="58" fill="#3B82F6" fillOpacity="0.10" />
      {/* téléphone */}
      <rect x="64" y="20" width="72" height="120" rx="12" fill="url(#phone-screen)" stroke="#3B82F6" strokeWidth="2" />
      <rect x="88" y="27" width="24" height="4" rx="2" fill="#334155" />
      {/* QR à l'écran */}
      <g fill="#3B82F6">
        <rect x="78" y="44" width="16" height="16" rx="2" />
        <rect x="106" y="44" width="16" height="16" rx="2" />
        <rect x="78" y="84" width="16" height="16" rx="2" />
        <rect x="100" y="50" width="6" height="6" rx="1" opacity="0.6" />
        <rect x="106" y="70" width="8" height="8" rx="1" opacity="0.6" />
        <rect x="100" y="92" width="8" height="8" rx="1" opacity="0.6" />
        <rect x="114" y="88" width="8" height="12" rx="1" opacity="0.6" />
      </g>
      <rect x="78" y="112" width="44" height="6" rx="3" fill="#334155" />
      {/* pastille validée */}
      <circle cx="132" cy="34" r="16" fill="#22C55E" />
      <path d="m125 34 5 5 9-9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

// ── Illustration Conformité : bouclier avec coche ────────────────────────────

export function ShieldIllustration({ className }: IconProps) {
  return (
    <svg viewBox="0 0 220 220" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="shield-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <radialGradient id="shield-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0" stopColor="#22C55E" stopOpacity="0.18" />
          <stop offset="1" stopColor="#22C55E" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="110" cy="105" r="100" fill="url(#shield-glow)" />
      {/* rayons décoratifs */}
      <g stroke="#3B82F6" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round">
        <line x1="110" y1="8" x2="110" y2="24" />
        <line x1="196" y1="58" x2="182" y2="66" />
        <line x1="24" y1="58" x2="38" y2="66" />
      </g>
      {/* bouclier */}
      <path
        d="M110 26l64 24v50c0 44-34 68-64 80-30-12-64-36-64-80V50l64-24Z"
        fill="url(#shield-grad)"
        stroke="#60A5FA"
        strokeWidth="2"
      />
      <path
        d="M110 42l48 18v42c0 33-26 51-48 60-22-9-48-27-48-60V60l48-18Z"
        fill="#0F172A"
        fillOpacity="0.25"
        stroke="#93C5FD"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      {/* coche */}
      <path d="m86 108 18 18 32-36" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
