/* Discord Design System - CSS Custom Properties and Design Tokens */

:root {
  /* ============== COLOR PALETTE ============== */
  
  /* Backgrounds */
  --discord-bg-primary: #1e1f22;     /* Server list background */
  --discord-bg-secondary: #2b2d31;   /* Channel/member list background */
  --discord-bg-tertiary: #313338;    /* Main chat background */
  --discord-bg-input: #383a40;       /* Input field background */
  --discord-bg-hover: #35373c;       /* Hover state background */
  --discord-bg-active: #404249;      /* Active/selected background */
  
  /* Text Colors */
  --discord-text-primary: #dcddde;       /* Main text */
  --discord-text-secondary: #8e9297;     /* Secondary/muted text */
  --discord-text-bright: #f2f3f5;        /* Bright/title text */
  
  /* Accent Colors */
  --discord-blue: #5865f2;       /* Primary accent (Discord blue) */
  --discord-green: #3ba55d;      /* Online status, success */
  --discord-red: #ed4245;        /* Danger, notifications */
  --discord-orange: #faa61a;     /* Idle status, warning */
  --discord-border: #4e5058;     /* Border color */
  
  /* ============== SPACING ============== */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  
  /* ============== LAYOUT DIMENSIONS ============== */
  --layout-server-width: 72px;
  --layout-channel-width: 240px;
  --layout-member-width: 240px;
  
  /* ============== BORDER RADIUS ============== */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-full: 50%;
  
  /* ============== TYPOGRAPHY ============== */
  --font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  --font-mono: 'Monaco', 'Courier New', monospace;
  
  /* Font sizes */
  --text-xs: 11px;
  --text-sm: 12px;
  --text-base: 14px;
  --text-md: 15px;
  --text-lg: 18px;
  --text-xl: 20px;
  
  /* Font weights */
  --weight-normal: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  
  /* ============== TRANSITIONS ============== */
  --transition-fast: 0.15s;
  --transition-normal: 0.3s;
  --transition-slow: 0.5s;
  
  /* ============== Z-INDEX ============== */
  --z-base: 0;
  --z-elevated: 100;
  --z-modal: 1000;
  --z-tooltip: 1100;
}

/* ============== COLOR PALETTE REFERENCE ============== */

/*
DISCORD COLOR SCHEME:

Primary Backgrounds:
- #1e1f22 - Darkest (server list)
- #2b2d31 - Dark (channels/members)
- #313338 - Medium (main chat)
- #383a40 - Input/forms
- #2e3035 - Hover/elevated

Text Colors:
- #f2f3f5 - Brightest (headings, important text)
- #dcddde - Primary text (messages)
- #8e9297 - Secondary text (timestamps, subtitles)
- #4e5058 - Tertiary text (placeholders)

Status Colors:
- #3ba55d - Online (green)
- #faa61a - Idle (orange)
- #ed4245 - Do not disturb / error (red)
- #4e5058 - Offline (gray)

Accent:
- #5865f2 - Discord Blue (primary accent)
- #438ad6 - Button hover state

Roles & Badges:
- Administrators: Purple/Blue tints
- Moderators: Orange tints
- Members: Default gray tints
- Bots: Blue badges

*/

/* ============== COMPONENT COLORS ============== */

/* Server Icons */
.server-color-ai { background: #2d7d46; }      /* Green */
.server-color-gaming { background: #703db5; }  /* Purple */
.server-color-dev { background: #c84b31; }     /* Red */
.server-color-default { background: #36393f; } /* Gray */

/* Role Colors */
.role-administrator { color: #7289da; } /* Blue */
.role-teacher { color: #f47fff; }       /* Pink/Purple */
.role-student { color: #43b581; }       /* Green */
.role-moderator { color: #faa61a; }     /* Orange */

/* Status Indicators */
.status-online { background: #3ba55d; }
.status-idle { background: #faa61a; }
.status-dnd { background: #ed4245; }
.status-offline { background: #4e5058; }

/* ============== RESPONSIVE BREAKPOINTS ============== */

/* Desktop: 1200px and up */
@media (min-width: 1200px) {
  /* Full 4-column layout visible */
}

/* Tablet: 768px to 1199px */
@media (min-width: 768px) and (max-width: 1199px) {
  --layout-channel-width: 200px;
  --layout-member-width: 200px;
}

/* Mobile: Below 768px */
@media (max-width: 767px) {
  /* Slide-out panels for channels and members */
}

/* Small Mobile: Below 480px */
@media (max-width: 479px) {
  /* Further optimizations for small screens */
}

/* ============== ACCESSIBILITY ============== */

/* High contrast mode support */
@media (prefers-contrast: more) {
  :root {
    --discord-border: #6d7580;
    --discord-text-secondary: #a0a5a9;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}

/* Dark mode (system preference) */
@media (prefers-color-scheme: dark) {
  /* Already using dark theme */
}

/* Light mode (future support) */
@media (prefers-color-scheme: light) {
  /* Future light theme implementation */
}
