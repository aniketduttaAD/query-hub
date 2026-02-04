'use client';

import type { ReactNode, ErrorInfo } from 'react';
import React from 'react';
import { logger } from '../../../lib/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('UI ErrorBoundary caught an error', error, {
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="text-sm font-semibold text-error">Something went wrong</div>
            <p className="text-xs text-text-muted mt-2">
              {this.state.message || 'An unexpected error occurred while rendering this section.'}
            </p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
