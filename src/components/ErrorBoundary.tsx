import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[VUXIO] Erro não tratado:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0e0e18] text-white gap-4 p-8">
          <p className="text-2xl font-bold text-purple-400">Algo correu mal</p>
          <p className="text-sm text-white/50 max-w-md text-center">
            {this.state.error?.message ?? 'Erro desconhecido'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 transition-colors text-sm font-semibold"
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
