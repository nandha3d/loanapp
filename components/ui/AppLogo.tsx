import React from 'react';
import { withBasePath } from '@/lib/public-path';

export type LogoVariant = 'horizontal' | 'square';
export type LogoTheme = 'dark' | 'light' | 'auto';

export interface AppLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  variant?: LogoVariant;
  theme?: LogoTheme;
  height?: number | string;
  width?: number | string;
}

/**
 * Universal ZoloFund logo component for Next.js webapp.
 * Supports horizontal (header/title) and square (icon/compact) geometries,
 * with light, dark, and auto (prefers-color-scheme) theme mappings.
 */
export default function AppLogo({
  variant = 'horizontal',
  theme = 'auto',
  height,
  width,
  alt = 'ZoloFund',
  style,
  className,
  ...props
}: AppLogoProps) {
  const darkSrc = withBasePath(
    variant === 'square'
      ? '/assets/logo-square-dark.png'
      : '/assets/logo-horizontal-dark.png'
  );
  const lightSrc = withBasePath(
    variant === 'square'
      ? '/assets/logo-square-light.png'
      : '/assets/logo-horizontal-light.png'
  );

  const imgStyle: React.CSSProperties = {
    height: height ?? 'auto',
    width: width ?? 'auto',
    objectFit: 'contain',
    display: 'inline-block',
    verticalAlign: 'middle',
    background: 'transparent',
    border: 'none',
    ...style,
  };

  if (theme === 'dark') {
    return (
      <img
        src={darkSrc}
        alt={alt}
        className={className}
        style={imgStyle}
        {...props}
      />
    );
  }

  if (theme === 'light') {
    return (
      <img
        src={lightSrc}
        alt={alt}
        className={className}
        style={imgStyle}
        {...props}
      />
    );
  }

  // Auto theme: uses standard <picture> to adapt to browser / OS color scheme
  return (
    <picture className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <source media="(prefers-color-scheme: dark)" srcSet={darkSrc} />
      <source media="(prefers-color-scheme: light)" srcSet={lightSrc} />
      <img
        src={lightSrc}
        alt={alt}
        style={imgStyle}
        {...props}
      />
    </picture>
  );
}
