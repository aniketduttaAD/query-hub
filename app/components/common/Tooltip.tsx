import { useState, type ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'bottom' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-1',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-1',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-1',
  };

  const arrowBorders = {
    top: 'border-t-surface border-t-border border-l-transparent border-r-transparent border-b-transparent',
    bottom:
      'border-b-surface border-b-border border-l-transparent border-r-transparent border-t-transparent',
    left: 'border-l-surface border-l-border border-t-transparent border-b-transparent border-r-transparent',
    right:
      'border-r-surface border-r-border border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocusCapture={(e) => {
        if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) {
          setIsVisible(true);
        }
      }}
      onBlurCapture={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={`
            absolute z-50 px-3 py-2 text-sm text-text-primary bg-surface border border-border rounded-md shadow-lg
            whitespace-normal max-w-xs sm:max-w-md leading-relaxed
            ${positionClasses[position]}
            animate-in fade-in zoom-in-95 duration-150
          `}
        >
          {content}
          <div
            className={`
              absolute w-0 h-0 border-4
              ${arrowClasses[position]}
              ${arrowBorders[position]}
            `}
            aria-hidden
          />
        </div>
      )}
    </div>
  );
}
