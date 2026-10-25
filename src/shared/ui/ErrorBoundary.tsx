import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../../i18n';
import { StateView } from './StateView';

interface Props {
  children: ReactNode;
  /** Hata görünümünü küçük göster (widget'lar için). */
  compact?: boolean;
  /** Değişince hata durumu sıfırlanır (ör. widget kimliği/ayarı). */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
  key: unknown;
}

/** Bir bileşen hata verirse yalnızca o alanı hata görünümüne çevirir; uygulamanın geri kalanı çalışır. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Yalnızca geliştirici konsoluna; kullanıcı verisi içermez.
    console.error('Bileşen hatası:', error.message, info.componentStack?.split('\n')[1]?.trim());
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <StateView
        kind="error"
        compact={this.props.compact}
        title={t('errors.componentTitle')}
        description={this.state.error.message}
        action={
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="h-9 rounded-lg border border-line px-3.5 text-sm font-medium hover:bg-surface-3"
          >
            {t('common.retry')}
          </button>
        }
      />
    );
  }
}
