import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-primary mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2
            bg-surface border rounded-md
            text-sm text-primary
            placeholder:text-text-muted
            focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
            disabled:bg-surface-hover disabled:cursor-not-allowed
            ${error ? 'border-error' : 'border-border'}
            ${className}
          `}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
