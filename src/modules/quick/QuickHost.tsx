import type { ServiceProps } from '../../core/modules/types';
import { useQuickRequests } from './quickService';

const noop = () => {};

/** Ana pencerede: hızlı pencereden gelen "panel aç / not aç" isteklerini işler. */
export default function QuickHost({ openPanel }: ServiceProps) {
  useQuickRequests(openPanel ?? noop);
  return null;
}
