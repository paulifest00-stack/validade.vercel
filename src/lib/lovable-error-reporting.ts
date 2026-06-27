type ErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

/**
 * Report errors to console and optionally to an external service.
 * Can be extended to integrate with Sentry, LogRocket, or similar services.
 */
export function reportLovableError(
  error: unknown,
  context: Record<string, unknown> = {},
  options: ErrorOptions = {}
) {
  if (typeof window === "undefined") return;

  const errorData = {
    error,
    context: {
      source: "react_error_boundary",
      route: window.location.pathname,
      timestamp: new Date().toISOString(),
      ...context,
    },
    options: {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
      ...options,
    },
  };

  // Log to console for development
  console.error("[Error Report]", errorData);

  // TODO: Integrate with external error tracking service (Sentry, LogRocket, etc.)
  // Example:
  // if (window.Sentry) {
  //   window.Sentry.captureException(error, { contexts: { app: context } });
  // }
}
