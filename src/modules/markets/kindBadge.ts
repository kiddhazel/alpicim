import type { BadgeTone } from '../../shared/ui/primitives';
import type { DataKind } from './types';

/** Veri türü etiketi (rozet tonu + metin anahtarı). Panel, alt şerit ve widget ortak kullanır. */
export const KIND_BADGE: Record<DataKind, { tone: BadgeTone; key: 'markets.kind.reference' | 'markets.kind.market' | 'markets.kind.derived' | 'markets.kind.demo' }> = {
  reference: { tone: 'neutral', key: 'markets.kind.reference' },
  market: { tone: 'accent', key: 'markets.kind.market' },
  derived: { tone: 'warn', key: 'markets.kind.derived' },
  demo: { tone: 'demo', key: 'markets.kind.demo' },
};
