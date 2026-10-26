import type { MutableRefObject } from 'react';

export interface AutoplayProps {
  /** Laila oynuyor: oyun kendi kendine ilerler, en iyi skor yazılmaz. */
  autoplay: boolean;
  /** Oyun güncel skorunu buraya yazar (bitiş olayı için). */
  scoreRef: MutableRefObject<number>;
  /** Oyun kendiliğinden bitti (kazanma/kaybetme). */
  onEnd: (result: 'win' | 'lose') => void;
}
