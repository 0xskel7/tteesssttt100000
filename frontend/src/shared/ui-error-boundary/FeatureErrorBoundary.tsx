"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { colors, radii, space, typography } from "@/shared/design-tokens";

interface Props {
  children: ReactNode;

  title?: string;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export class FeatureErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    console.error("[FeatureErrorBoundary]", error, info.componentStack);
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          style={{
            padding: space.lg,
            margin: space.md,
            borderRadius: radii.md,
            background: colors.surface.elev,
            border: `1px solid ${colors.surface.line}`,
            color: colors.text.primary,
            fontFamily: typography.fontBody,
          }}
        >
          <h2 style={{ fontFamily: typography.fontDisplay, marginBottom: space.sm }}>
            {this.props.title ?? "Something went wrong"}
          </h2>
          <p style={{ color: colors.text.secondary, marginBottom: space.md }}>
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={this.retry}
            style={{
              background: colors.brand.primary,
              color: colors.text.inverse,
              border: "none",
              borderRadius: radii.pill,
              padding: `${space.sm} ${space.lg}`,
              fontWeight: typography.weight.semibold,
              cursor: "pointer",
              fontFamily: typography.fontBody,
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
