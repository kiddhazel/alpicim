import { createContext, useContext } from 'react';
import type { PanelId } from '../window-manager/panels';

/** Widget'ların kabukla etkileşimi (ör. ilgili paneli açmak). */
export interface WidgetHostApi {
  openPanel: (panel: PanelId) => void;
  /** Adresi uygulamanın tarayıcı sekmesinde açar. */
  openUrl: (url: string) => void;
}

export const WidgetHostContext = createContext<WidgetHostApi>({ openPanel: () => {}, openUrl: () => {} });

export function useWidgetHost(): WidgetHostApi {
  return useContext(WidgetHostContext);
}
