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
  className = '',
  ...props
}: AppLogoProps) {
  // Official ZoloFunds brand purple logos
  const zoloDarkSrc = withBasePath(
    variant === 'square'
      ? '/assets/logo-square-dark.png'
      : '/assets/logo-horizontal-for-dark-bg.png'
  );
  const zoloLightSrc = withBasePath(
    variant === 'square'
      ? '/assets/logo-square-light.png'
      : '/assets/logo-horizontal-for-light-bg.png'
  );

  // Fallback Samurai brand amber logos
  const samuraiDarkSrc = withBasePath(
    variant === 'square'
      ? '/assets/logo-square-dark.png'
      : '/assets/logo-horizontal-dark.png'
  );
  const samuraiLightSrc = withBasePath(
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

  const renderVariant = (darkSrc: string, lightSrc: string, brandClass: string) => {
    const combinedClass = [className, brandClass].filter(Boolean).join(' ');

    if (theme === 'dark') {
      return (
        <img
          src={darkSrc}
          alt={alt}
          className={combinedClass}
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
          className={combinedClass}
          style={imgStyle}
          {...props}
        />
      );
    }

    return (
      <picture className={combinedClass} style={{ display: 'inline-flex', alignItems: 'center' }}>
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
  };

  return (
    <>
      {renderVariant(zoloDarkSrc, zoloLightSrc, 'logo-zolofunds')}
      {renderVariant(samuraiDarkSrc, samuraiLightSrc, 'logo-samurai')}
    </>
  );
}
