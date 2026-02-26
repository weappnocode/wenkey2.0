import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, info);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 max-w-md w-full space-y-4">
                        <h2 className="text-xl font-semibold text-destructive">Algo deu errado</h2>
                        <p className="text-sm text-muted-foreground">
                            Ocorreu um erro inesperado. Você pode tentar novamente ou recarregar a página.
                        </p>
                        {this.state.error && (
                            <pre className="text-xs text-left bg-muted rounded p-3 overflow-auto max-h-40">
                                {this.state.error.message}
                            </pre>
                        )}
                        <div className="flex gap-2 justify-center">
                            <button
                                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
                                onClick={this.handleReset}
                            >
                                Tentar Novamente
                            </button>
                            <button
                                className="px-4 py-2 rounded-md border text-sm hover:bg-muted transition-colors"
                                onClick={() => window.location.reload()}
                            >
                                Recarregar Página
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
