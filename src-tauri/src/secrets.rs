//! API anahtarları için Windows Kimlik Bilgisi Yöneticisi (Credential Manager) erişimi.
//!
//! Sınırlar: Anahtar, oturum açmış Windows kullanıcısının kimlik bilgisi kasasında saklanır.
//! Aynı kullanıcı hesabıyla çalışan başka programlar teorik olarak okuyabilir; dosya sisteminde
//! düz metin olarak durmaz ve webview'e asla geri gönderilmez (yalnızca "kayıtlı mı?" bilgisi).
//! Hangi sağlayıcıların anahtar saklayabileceği `providers::PROVIDERS` tablosundan gelir.

use crate::providers;

/// Kimlik kasasındaki hizmet adı. Değiştirilirse kullanıcıların kayıtlı anahtarları "kaybolur".
const SERVICE: &str = "com.alperen.alpicim";

fn entry(provider: &str) -> Result<keyring::Entry, String> {
    let p = providers::find(provider)?;
    keyring::Entry::new(SERVICE, p.id).map_err(|e| format!("Kimlik kasası açılamadı: {e}"))
}

/// Anahtar biçim denetimi: boş olmayan, en fazla 512 karakter, yalnızca görünür ASCII
/// (boşluk/satır sonu yok → başlık ya da adres enjeksiyonu yapılamaz).
pub fn validate_key(value: &str) -> Result<&str, String> {
    let value = value.trim();
    if value.is_empty() || value.len() > 512 || !value.chars().all(|c| c.is_ascii_graphic()) {
        return Err("Geçersiz anahtar".into());
    }
    Ok(value)
}

/// Rust içinden (ör. ağ katmanı) anahtar okumak için. Webview'e açılmaz.
pub fn get(provider: &str) -> Option<String> {
    entry(provider)
        .ok()?
        .get_password()
        .ok()
        .filter(|v| validate_key(v).is_ok())
}

// Kimlik kasası çağrıları ana iş parçacığında yapılmasın diye komutlar async.
#[tauri::command]
pub async fn secret_set(provider: String, value: String) -> Result<(), String> {
    let value = validate_key(&value)?;
    entry(&provider)?
        .set_password(value)
        .map_err(|e| format!("Anahtar kaydedilemedi: {e}"))
}

#[tauri::command]
pub async fn secret_clear(provider: String) -> Result<(), String> {
    match entry(&provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Anahtar silinemedi: {e}")),
    }
}

#[tauri::command]
pub async fn secret_status(provider: String) -> Result<bool, String> {
    entry(&provider)?;
    Ok(get(&provider).is_some())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_format() {
        assert_eq!(validate_key("  abc-123_XYZ  ").unwrap(), "abc-123_XYZ");
        assert!(validate_key("").is_err());
        assert!(validate_key("   ").is_err());
        assert!(validate_key("ab cd").is_err());
        assert!(validate_key("abc\r\nX-Evil: 1").is_err());
        assert!(validate_key("anahtarğ").is_err());
        assert!(validate_key(&"a".repeat(513)).is_err());
    }

    #[test]
    fn unknown_provider_has_no_entry() {
        assert!(entry("bilinmeyen").is_err());
    }
}
