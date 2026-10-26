import { call } from '../../shared/lib/tauri';

/** Laila'nın masaüstü penceresi (görev çubuğu üstünde gezinme) için Rust komutları. */

export const LAILA_LABEL = 'laila';
/** Masaüstü penceresi kapanınca (Laila eve döndüğünde) yayılır. */
export const LAILA_RETURN_EVENT = 'alpicim://laila-return';

/** Birincil monitör (fiziksel piksel). `workBottom`: çalışma alanının alt kenarı (= görev çubuğunun üstü). */
export interface LailaGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  workBottom: number;
  scale: number;
}

export const lailaService = {
  /** Masaüstü penceresini oluşturur (gizli başlar; ilk `place` çağrısı gösterir). */
  goOutside: () => call<void>('laila_desktop_show'),
  /** Masaüstü penceresini kapatır ve LAILA_RETURN_EVENT yayar. */
  comeBack: () => call<void>('laila_desktop_hide'),
  geometry: () => call<LailaGeometry>('laila_geometry'),
  /** Pencereyi fiziksel piksel cinsinden konumlandırır/boyutlandırır, görünür değilse gösterir. */
  place: (x: number, y: number, width: number, height: number) =>
    call<void>('laila_place', { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }),
  openMain: () => call<void>('laila_open_main'),
};
