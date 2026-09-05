import { Component, ErrorBoundary as SolidErrorBoundary, onMount } from 'solid-js';
import { handleError } from './errorHandler';

interface ErrorBoundaryProps {
  fallback?: Component<{ error: Error; resetError: () => void }>;
  children: unknown;
}

const DefaultFallback: Component<{ error: Error; resetError: () => void }> = ({ error, resetError }) => {
  return (
    <div class="flex flex-col items-center justify-center h-full p-6 bg-red-50">
      <div class="text-red-500 text-xl font-bold mb-4">Oops! Something went wrong</div>
      <div class="text-gray-600 text-sm mb-6 max-w-xs text-center">{error.message}</div>
      <button
        onClick={resetError}
        class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
      >
        Try Again
      </button>
    </div>
  );
};

const ErrorBoundary: Component<ErrorBoundaryProps> = (props) => {
  const Fallback = props.fallback || DefaultFallback;

  return (
    <SolidErrorBoundary
      fallback={(error, resetError) => <Fallback error={error} resetError={resetError} />}
      onError={(error) => {
        handleError(error);
      }}
    >
      {props.children}
    </SolidErrorBoundary>
  );
};

export default ErrorBoundary;