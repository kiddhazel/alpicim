//! Uygulama başlatıcı: kullanıcının eklediği uygulama, kısayol, klasör ve dosyaları saklar ve açar.
//!
//! Güvenlik ilkeleri:
//! - Webview herhangi bir yolu doğrudan "çalıştıramaz"; yalnızca kayıtlı bir öğenin kimliğini gönderir.
//! - Komut satırı argümanı ya da kabuk komutu desteklenmez.
//! - Betik dosyaları (.bat, .cmd, .ps1, .vbs ...) eklenemez ve açılamaz.
//! - Açmadan önce hedefin hâlâ var olduğu doğrulanır.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tauri_plugin_opener::OpenerExt;

const FILE: &str = "launcher.json";

const BLOCKED_EXTENSIONS: &[&str] = &[
    "bat", "cmd", "ps1", "psm1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "hta", "scr", "reg", "msc",
    "cpl", "jar", "com", "pif",
];

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ItemKind {
    App,
    Shortcut,
    Folder,
    File,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub kind: ItemKind,
    pub icon: String,
    pub category: String,
    pub favorite: bool,
    pub added_at: u64,
    /// Kısayolun çözülmüş hedefi (.exe yolu veya steam:// gibi adres) — yalnızca bilgi amaçlı.
    #[serde(default)]
    pub target: Option<String>,
}

/// Webview'e dönen görünüm: öğe + hedef hâlâ mevcut mu?
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchItemView {
    #[serde(flatten)]
    pub item: LaunchItem,
    pub exists: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchItemPatch {
    pub id: String,
    pub name: Option<String>,
    pub icon: Option<String>,
    pub category: Option<String>,
    pub favorite: Option<bool>,
}

pub struct LauncherState {
    items: Mutex<Vec<LaunchItem>>,
    path: PathBuf,
}

impl LauncherState {
    pub fn load(dir: PathBuf) -> Self {
        let path = dir.join(FILE);
        let items = fs::read_to_string(&path)
            .ok()
            .and_then(|t| serde_json::from_str::<Vec<LaunchItem>>(&t).ok())
            .unwrap_or_default();
        Self { items: Mutex::new(items), path }
    }

    fn persist(&self, items: &[LaunchItem]) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let json = serde_json::to_string_pretty(items).map_err(|e| e.to_string())?;
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, json).map_err(|e| e.to_string())?;
        fs::rename(&tmp, &self.path).map_err(|e| e.to_string())
    }

    fn mutate<T>(&self, f: impl FnOnce(&mut Vec<LaunchItem>) -> Result<T, String>) -> Result<T, String> {
        let mut guard = self.items.lock().unwrap_or_else(|e| e.into_inner());
        let result = f(&mut guard)?;
        self.persist(&guard)?;
        Ok(result)
    }

    fn views(&self) -> Vec<LaunchItemView> {
        let guard = self.items.lock().unwrap_or_else(|e| e.into_inner());
        guard
            .iter()
            .map(|item| LaunchItemView { exists: Path::new(&item.path).exists(), item: item.clone() })
            .collect()
    }

    fn find(&self, id: &str) -> Option<LaunchItem> {
        let guard = self.items.lock().unwrap_or_else(|e| e.into_inner());
        guard.iter().find(|i| i.id == id).cloned()
    }
}

fn extension(path: &Path) -> String {
    path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase()
}

/// Yolu doğrular ve türünü belirler.
pub fn classify(path: &Path) -> Result<ItemKind, String> {
    if !path.is_absolute() {
        return Err("Yol tam (mutlak) olmalı".into());
    }
    if !path.exists() {
        return Err("Hedef bulunamadı. Dosya taşınmış veya silinmiş olabilir.".into());
    }
    if path.is_dir() {
        return Ok(ItemKind::Folder);
    }
    let ext = extension(path);
    if BLOCKED_EXTENSIONS.contains(&ext.as_str()) {
        return Err(format!(
            ".{ext} uzantılı betik/sistem dosyaları güvenlik nedeniyle başlatıcıya eklenemez"
        ));
    }
    Ok(match ext.as_str() {
        "exe" => ItemKind::App,
        "lnk" | "url" | "appref-ms" => ItemKind::Shortcut,
        _ => ItemKind::File,
    })
}

fn default_name(path: &Path) -> String {
    path.file_stem()
        .or_else(|| path.file_name())
        .and_then(|s| s.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| path.display().to_string())
}

fn default_icon(kind: &ItemKind) -> &'static str {
    match kind {
        ItemKind::App => "app-window",
        ItemKind::Shortcut => "external-link",
        ItemKind::Folder => "folder",
        ItemKind::File => "file",
    }
}

fn now_millis() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn new_id() -> String {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    format!("item-{nanos:x}")
}

fn clean_text(value: &str, max: usize) -> String {
    value.trim().chars().filter(|c| !c.is_control()).take(max).collect()
}

#[tauri::command]
pub fn launcher_list(state: tauri::State<'_, LauncherState>) -> Vec<LaunchItemView> {
    state.views()
}

#[tauri::command]
pub async fn launcher_add(
    state: tauri::State<'_, LauncherState>,
    path: String,
    name: Option<String>,
    category: Option<String>,
) -> Result<Vec<LaunchItemView>, String> {
    let p = PathBuf::from(path.trim());
    let kind = classify(&p)?;
    let path_str = p.display().to_string();
    state.mutate(|items| {
        if items.iter().any(|i| i.path.eq_ignore_ascii_case(&path_str)) {
            return Err("Bu hedef zaten listede".into());
        }
        let name = name.map(|n| clean_text(&n, 80)).filter(|n| !n.is_empty());
        items.push(LaunchItem {
            id: new_id(),
            name: name.unwrap_or_else(|| default_name(&p)),
            icon: default_icon(&kind).to_string(),
            kind,
            path: path_str.clone(),
            category: category.map(|c| clean_text(&c, 40)).unwrap_or_default(),
            favorite: false,
            added_at: now_millis(),
            target: None,
        });
        Ok(())
    })?;
    Ok(state.views())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewItem {
    pub path: String,
    pub name: Option<String>,
    pub category: Option<String>,
    pub target: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddManyResult {
    pub items: Vec<LaunchItemView>,
    pub added: usize,
    pub skipped: usize,
}

/// Taramadan seçilen öğeleri toplu ekler; geçersiz veya zaten var olanları atlar.
#[tauri::command]
pub async fn launcher_add_many(
    state: tauri::State<'_, LauncherState>,
    items: Vec<NewItem>,
) -> Result<AddManyResult, String> {
    let (added, skipped) = state.mutate(|list| {
        let mut added = 0;
        let mut skipped = 0;
        for (i, it) in items.into_iter().enumerate() {
            let p = PathBuf::from(it.path.trim());
            let Ok(kind) = classify(&p) else {
                skipped += 1;
                continue;
            };
            let path_str = p.display().to_string();
            if list.iter().any(|x| x.path.eq_ignore_ascii_case(&path_str)) {
                skipped += 1;
                continue;
            }
            let name = it.name.map(|n| clean_text(&n, 80)).filter(|n| !n.is_empty());
            list.push(LaunchItem {
                id: format!("{}-{i}", new_id()),
                name: name.unwrap_or_else(|| default_name(&p)),
                icon: it.icon.map(|s| clean_text(&s, 40)).unwrap_or_else(|| default_icon(&kind).to_string()),
                kind,
                path: path_str,
                category: it.category.map(|c| clean_text(&c, 40)).unwrap_or_default(),
                favorite: false,
                added_at: now_millis(),
                target: it.target.map(|t| clean_text(&t, 1024)),
            });
            added += 1;
        }
        Ok((added, skipped))
    })?;
    Ok(AddManyResult { items: state.views(), added, skipped })
}

/// Başlat menüsü ve masaüstündeki uygulama/oyun kısayollarını tarar (diske yazmaz).
#[tauri::command]
pub async fn launcher_scan() -> Result<Vec<crate::scanner::ScannedApp>, String> {
    tauri::async_runtime::spawn_blocking(crate::scanner::scan)
        .await
        .map_err(|e| format!("Tarama başarısız: {e}"))
}

/// Dosyanın Windows simgesini PNG data URL olarak döndürür (önbellekli). Yalnızca var olan dosyalar.
#[tauri::command]
pub async fn launcher_icon<R: Runtime>(app: AppHandle<R>, path: String) -> Result<Option<String>, String> {
    use tauri::Manager;
    let p = PathBuf::from(&path);
    if !p.is_absolute() || !p.exists() {
        return Ok(None);
    }
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || crate::scanner::icon_data_url(&cache, &p))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn launcher_update(
    state: tauri::State<'_, LauncherState>,
    patch: LaunchItemPatch,
) -> Result<Vec<LaunchItemView>, String> {
    state.mutate(|items| {
        let item = items.iter_mut().find(|i| i.id == patch.id).ok_or("Öğe bulunamadı")?;
        if let Some(name) = patch.name.map(|n| clean_text(&n, 80)).filter(|n| !n.is_empty()) {
            item.name = name;
        }
        if let Some(icon) = patch.icon {
            item.icon = clean_text(&icon, 40);
        }
        if let Some(category) = patch.category {
            item.category = clean_text(&category, 40);
        }
        if let Some(fav) = patch.favorite {
            item.favorite = fav;
        }
        Ok(())
    })?;
    Ok(state.views())
}

#[tauri::command]
pub fn launcher_remove(
    state: tauri::State<'_, LauncherState>,
    id: String,
) -> Result<Vec<LaunchItemView>, String> {
    state.mutate(|items| {
        items.retain(|i| i.id != id);
        Ok(())
    })?;
    Ok(state.views())
}

/// Verilen kimlik sırasına göre yeniden sıralar. Listede olmayanlar sona eklenir.
#[tauri::command]
pub fn launcher_reorder(
    state: tauri::State<'_, LauncherState>,
    ids: Vec<String>,
) -> Result<Vec<LaunchItemView>, String> {
    state.mutate(|items| {
        items.sort_by_key(|i| ids.iter().position(|id| *id == i.id).unwrap_or(usize::MAX));
        Ok(())
    })?;
    Ok(state.views())
}

// Async: dosya denetimi, pencere arama ve ShellExecute ana (UI) iş parçacığını bekletmesin.
#[tauri::command]
pub async fn launcher_launch<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, LauncherState>,
    id: String,
    focus_existing: Option<bool>,
) -> Result<&'static str, String> {
    let item = state.find(&id).ok_or("Öğe bulunamadı")?;
    let path = PathBuf::from(&item.path);
    // Kayıt sonrası dosya değişmiş olabilir: yeniden doğrula.
    classify(&path)?;
    // Akıllı kısayol: uygulamanın (.exe) açık penceresi varsa yeni örnek yerine onu öne getir.
    #[cfg(windows)]
    if focus_existing.unwrap_or(false) {
        let exe = item
            .target
            .clone()
            .filter(|t| t.to_ascii_lowercase().ends_with(".exe"))
            .or_else(|| (item.kind == ItemKind::App).then(|| item.path.clone()));
        if let Some(exe) = exe {
            if crate::embed::focus_exe(&exe) {
                return Ok("focused");
            }
        }
    }
    #[cfg(not(windows))]
    let _ = focus_existing;
    app.opener()
        .open_path(item.path.clone(), None::<&str>)
        .map_err(|e| format!("Açılamadı: {e}"))?;
    Ok("launched")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_relative_paths() {
        assert!(classify(Path::new("notepad.exe")).is_err());
    }

    #[test]
    fn rejects_missing_targets() {
        let p = std::env::temp_dir().join("alpicim-yok-boyle-bir-dosya.exe");
        assert!(classify(&p).unwrap_err().contains("bulunamadı"));
    }

    #[test]
    fn classifies_folders_and_blocks_scripts() {
        let dir = std::env::temp_dir().join(format!("alpicim-test-{}", new_id()));
        fs::create_dir_all(&dir).unwrap();
        assert_eq!(classify(&dir).unwrap(), ItemKind::Folder);

        let script = dir.join("calistir.bat");
        fs::write(&script, "echo hi").unwrap();
        assert!(classify(&script).is_err());

        let doc = dir.join("not.txt");
        fs::write(&doc, "x").unwrap();
        assert_eq!(classify(&doc).unwrap(), ItemKind::File);

        let _ = fs::remove_dir_all(&dir);
    }
}
