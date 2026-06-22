'use client';

import { useState } from 'react';
import type { CSSProperties, InputHTMLAttributes } from 'react';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
  toggleStyle?: CSSProperties;
  prefixIcon?: string;
  prefixStyle?: CSSProperties;
};

export default function PasswordInput({
  wrapperClassName,
  wrapperStyle,
  toggleStyle,
  prefixIcon,
  prefixStyle,
  className,
  style,
  disabled,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputStyle: CSSProperties = {
    ...(prefixIcon ? { paddingLeft: '44px' } : {}),
    paddingRight: '44px',
    ...style,
  };

  return (
    <div className={wrapperClassName} style={{ position: 'relative', ...wrapperStyle }}>
      {prefixIcon && (
        <span
          className="material-icons-outlined"
          style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '20px',
            color: 'var(--text-light)',
            ...prefixStyle,
          }}
        >
          {prefixIcon}
        </span>
      )}
      <input
        {...props}
        disabled={disabled}
        type={visible ? 'text' : 'password'}
        className={className}
        style={inputStyle}
      />
      <button
        type="button"
        onClick={() => setVisible((next) => !next)}
        disabled={disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: disabled ? 'default' : 'pointer',
          padding: '2px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...toggleStyle,
        }}
      >
        <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
          {visible ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  );
}
