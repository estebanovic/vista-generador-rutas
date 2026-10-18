/** Set monoline — trazo 1.4px, `currentColor`, viewBox 24×24. */
import type { CSSProperties, ReactNode } from 'react';

export interface IconProps {
  size?: number;
  style?: CSSProperties;
  className?: string;
}

function Icon({
  children,
  size = 16,
  ...rest
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export type IconComponent = (p: IconProps) => ReactNode;

export const IconMoto: IconComponent = (p) => (
  <Icon {...p}>
    <circle cx="5" cy="16" r="3" />
    <circle cx="19" cy="16" r="3" />
    <path d="M5 16l4-7h4l3 4M16 13l3 3M13 9h3M9 9l-2-3" />
  </Icon>
);

export const Icon4x4: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M2 14l1.6-5A2 2 0 015.5 7.6h13A2 2 0 0120.4 9L22 14v4h-2.5a2 2 0 11-4 0h-7a2 2 0 11-4 0H2v-4z" />
    <path d="M7 11h4M14 11h4" />
  </Icon>
);

export const IconCompass: IconComponent = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" fillOpacity="0.15" />
  </Icon>
);

export const IconSearch: IconComponent = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.3-4.3" />
  </Icon>
);

export const IconPin: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M12 21s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z" />
    <circle cx="12" cy="9" r="2.2" />
  </Icon>
);

export const IconFlag: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Icon>
);

export const IconSwap: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M7 4v15M4 7l3-3 3 3M17 20V5M14 17l3 3 3-3" />
  </Icon>
);

export const IconCurves: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M3 17c3 0 3-10 6-10s3 10 6 10 3-6 6-6" />
  </Icon>
);

export const IconPlus: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const IconMinus: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);

export const IconLocate: IconComponent = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Icon>
);

export const IconArrow: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

export const IconDownload: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
  </Icon>
);

export const IconPrint: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M7 9V3h10v6M7 18H4v-7h16v7h-3M7 14h10v7H7z" />
  </Icon>
);

export const IconChevronDown: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

export const IconLandscape: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M3 19l5-7 3 4 3-6 7 9z" />
    <circle cx="17" cy="7" r="1.5" />
  </Icon>
);

export const IconLayers: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5M3 17l9 5 9-5" />
  </Icon>
);
