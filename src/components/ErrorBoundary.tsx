import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError("[ErrorBoundary] Caught an error:", { error, errorInfo });
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-background text-foreground">
          <div className="max-w-md text-center space-y-4">
            <h2 className="text-xl font-semibold text-destructive">出现错误</h2>
            <p className="text-sm text-muted-foreground">
              应用遇到了一个意外错误。请尝试刷新页面或重启应用。
            </p>
            {this.state.error && (
              <details className="text-left text-xs bg-muted p-4 rounded-md overflow-auto max-h-[200px]">
                <summary className="cursor-pointer font-medium mb-2">错误详情</summary>
                <pre className="whitespace-pre-wrap break-all">{this.state.error.message}</pre>
                {this.state.errorInfo && (
                  <pre className="whitespace-pre-wrap break-all mt-2 text-[10px] text-muted-foreground">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}
            <div className="flex gap-2 justify-center">
              <Button
                variant="default"
                onClick={() => window.location.reload()}
              >
                刷新页面
              </Button>
              <Button
                variant="outline"
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              >
                尝试恢复
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
