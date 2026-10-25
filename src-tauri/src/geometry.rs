//! Pencere geometrisi için saf (yan etkisiz) hesaplamalar.
//! Tauri çalışma zamanına bağlı değildir; bu yüzden birim testleri hızlı ve deterministiktir.

use serde::{Deserialize, Serialize};

/// Fiziksel piksel cinsinden dikdörtgen (sol üst köşe + boyut).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl Rect {
    pub fn new(x: i32, y: i32, width: u32, height: u32) -> Self {
        Self { x, y, width, height }
    }

    fn right(&self) -> i64 {
        self.x as i64 + self.width as i64
    }

    fn bottom(&self) -> i64 {
        self.y as i64 + self.height as i64
    }

    /// İki dikdörtgenin kesişim alanının (genişlik, yükseklik) değerleri.
    pub fn overlap(&self, other: &Rect) -> (i64, i64) {
        let w = self.right().min(other.right()) - (self.x as i64).max(other.x as i64);
        let h = self.bottom().min(other.bottom()) - (self.y as i64).max(other.y as i64);
        (w.max(0), h.max(0))
    }
}

/// Başlık çubuğu kabul edilen üst şeridin yüksekliği.
const TITLE_STRIP: u32 = 36;
/// Pencerenin "erişilebilir" sayılması için başlık şeridinin görünmesi gereken asgari genişlik.
const MIN_VISIBLE_WIDTH: i64 = 120;
const MIN_VISIBLE_HEIGHT: i64 = 20;

/// Kayıtlı bir pencere konumunun mevcut monitörlerde kullanılabilir olup olmadığını denetler.
/// Başlık çubuğunun yeterince görünür olduğu bir monitör yoksa pencereyi birincil
/// monitörün çalışma alanına ortalar ve sığacak biçimde küçültür.
pub fn clamp_to_monitors(rect: Rect, work_areas: &[Rect], primary: Option<Rect>) -> Rect {
    if work_areas.is_empty() {
        return rect;
    }

    let strip = Rect::new(rect.x, rect.y, rect.width, TITLE_STRIP.min(rect.height.max(1)));
    let min_w = MIN_VISIBLE_WIDTH.min(rect.width as i64);
    let reachable = work_areas.iter().any(|area| {
        let (w, h) = strip.overlap(area);
        w >= min_w && h >= MIN_VISIBLE_HEIGHT.min(strip.height as i64)
    });

    if reachable {
        return rect;
    }

    let target = primary.unwrap_or(work_areas[0]);
    center_in(rect.width, rect.height, target)
}

/// Verilen boyutu alana sığdırıp ortalar.
pub fn center_in(width: u32, height: u32, area: Rect) -> Rect {
    let w = width.min(area.width);
    let h = height.min(area.height);
    let x = area.x + ((area.width - w) / 2) as i32;
    let y = area.y + ((area.height - h) / 2) as i32;
    Rect::new(x, y, w, h)
}

/// Monitör seçimi için gereken asgari bilgi (Tauri `Monitor`'dan bağımsız, test edilebilir).
#[derive(Clone, Debug, PartialEq)]
pub struct MonitorInfo {
    /// Windows aygıt adı, ör. `\\.\DISPLAY2`.
    pub name: String,
    pub rect: Rect,
    pub primary: bool,
}

/// Hedef monitörü seçer:
/// 1. `preferred` adlı monitör bağlıysa o,
/// 2. değilse (veya tercih yoksa) birincil olmayan ilk monitör (ikinci ekran),
/// 3. o da yoksa birincil monitör, en sonda listedeki ilk monitör.
pub fn pick_monitor(monitors: &[MonitorInfo], preferred: Option<&str>) -> Option<usize> {
    if let Some(name) = preferred.filter(|n| !n.is_empty()) {
        if let Some(i) = monitors.iter().position(|m| m.name == name) {
            return Some(i);
        }
    }
    monitors
        .iter()
        .position(|m| !m.primary)
        .or_else(|| monitors.iter().position(|m| m.primary))
        .or(if monitors.is_empty() { None } else { Some(0) })
}

/// Monitörde hangi monitörün bir noktayı içerdiği (pencere merkezine göre bulunduğu ekran).
pub fn monitor_at(monitors: &[MonitorInfo], x: i32, y: i32) -> Option<usize> {
    monitors.iter().position(|m| {
        let r = m.rect;
        (x as i64) >= r.x as i64 && (x as i64) < r.right() && (y as i64) >= r.y as i64 && (y as i64) < r.bottom()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const FHD: Rect = Rect { x: 0, y: 0, width: 1920, height: 1040 };

    fn mon(name: &str, rect: Rect, primary: bool) -> MonitorInfo {
        MonitorInfo { name: name.into(), rect, primary }
    }

    #[test]
    fn picks_secondary_by_default() {
        let list = [mon("A", FHD, true), mon("B", SECOND, false)];
        assert_eq!(pick_monitor(&list, None), Some(1));
    }

    #[test]
    fn picks_preferred_when_connected() {
        let list = [mon("A", FHD, true), mon("B", SECOND, false)];
        assert_eq!(pick_monitor(&list, Some("A")), Some(0));
    }

    #[test]
    fn falls_back_to_primary_when_preferred_and_secondary_missing() {
        let list = [mon("A", FHD, true)];
        assert_eq!(pick_monitor(&list, Some("B")), Some(0));
        assert_eq!(pick_monitor(&[], Some("B")), None);
    }

    #[test]
    fn finds_monitor_at_point() {
        let list = [mon("A", FHD, true), mon("B", SECOND, false)];
        assert_eq!(monitor_at(&list, 2000, 100), Some(1));
        assert_eq!(monitor_at(&list, 10, 10), Some(0));
        assert_eq!(monitor_at(&list, -10, 10), None);
    }
    const SECOND: Rect = Rect { x: 1920, y: 0, width: 2560, height: 1400 };

    #[test]
    fn keeps_visible_window() {
        let r = Rect::new(100, 100, 800, 600);
        assert_eq!(clamp_to_monitors(r, &[FHD], Some(FHD)), r);
    }

    #[test]
    fn keeps_window_on_second_monitor_when_connected() {
        let r = Rect::new(2200, 200, 900, 700);
        assert_eq!(clamp_to_monitors(r, &[FHD, SECOND], Some(FHD)), r);
    }

    #[test]
    fn moves_window_from_disconnected_monitor_to_primary() {
        let r = Rect::new(2200, 200, 900, 700);
        let out = clamp_to_monitors(r, &[FHD], Some(FHD));
        assert_eq!(out, Rect::new(510, 170, 900, 700));
    }

    #[test]
    fn shrinks_oversized_window_when_relocating() {
        let r = Rect::new(-5000, -5000, 3000, 2000);
        let out = clamp_to_monitors(r, &[FHD], Some(FHD));
        assert_eq!(out, Rect::new(0, 0, 1920, 1040));
    }

    #[test]
    fn title_bar_above_screen_is_relocated() {
        // Gövde görünür ama başlık çubuğu ekranın üstünde kalmış: tutulamaz, taşınmalı.
        let r = Rect::new(100, -300, 800, 600);
        let out = clamp_to_monitors(r, &[FHD], Some(FHD));
        assert_ne!(out, r);
        assert!(out.y >= 0);
    }


}
