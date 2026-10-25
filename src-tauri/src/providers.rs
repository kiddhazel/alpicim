//! Anahtarlı sağlayıcı tablosu — `secrets.rs` (hangi anahtar saklanabilir) ve `net.rs` (anahtar nereye,
//! nasıl gönderilir) aynı tabloyu kullanır. Anahtarın gönderim biçimi yalnızca burada tanımlanır;
//! webview yalnızca sağlayıcı kimliğini söyler, sunucuyu ya da başlığı seçemez.

use url::Url;

/// Anahtarın isteğe eklenme biçimi.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Auth {
    /// HTTP başlığı: `name: <prefix><anahtar>`
    Header { name: &'static str, prefix: &'static str },
    /// Sorgu parametresi: `?param=<anahtar>` (sağlayıcı başlık desteklemiyorsa)
    Query { param: &'static str },
}

#[derive(Debug)]
pub struct Provider {
    pub id: &'static str,
    /// Anahtarın gönderilebileceği tek sunucu (yalnız https, varsayılan bağlantı noktası).
    pub host: &'static str,
    pub auth: Auth,
}

pub const PROVIDERS: &[Provider] = &[
    Provider {
        id: "twelvedata",
        host: "api.twelvedata.com",
        auth: Auth::Header { name: "Authorization", prefix: "apikey " },
    },
    Provider {
        id: "openweathermap",
        host: "api.openweathermap.org",
        auth: Auth::Query { param: "appid" },
    },
];

pub fn find(id: &str) -> Result<&'static Provider, String> {
    PROVIDERS
        .iter()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("Bilinmeyen sağlayıcı: {id}"))
}

/// Anahtar yalnızca sağlayıcının kendi sunucusuna, https ile gönderilebilir.
pub fn check_url(provider: &Provider, url: &Url) -> Result<(), String> {
    if url.scheme() != "https" || url.host_str() != Some(provider.host) || url.port().is_some() {
        return Err("Anahtar yalnızca sağlayıcının kendi sunucusuna gönderilebilir".into());
    }
    Ok(())
}

/// Anahtarı uygular: sorgu parametresiyse adrese ekler (aynı adlı parametre önce silinir),
/// başlıksa eklenecek (ad, değer) çiftini döndürür.
pub fn apply(provider: &Provider, url: &mut Url, key: &str) -> Option<(&'static str, String)> {
    match provider.auth {
        Auth::Header { name, prefix } => Some((name, format!("{prefix}{key}"))),
        Auth::Query { param } => {
            let kept: Vec<(String, String)> = url
                .query_pairs()
                .filter(|(k, _)| !k.eq_ignore_ascii_case(param))
                .map(|(k, v)| (k.into_owned(), v.into_owned()))
                .collect();
            url.query_pairs_mut().clear().extend_pairs(kept).append_pair(param, key);
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_provider_rejected() {
        assert!(find("twelvedata").is_ok());
        assert!(find("openweathermap").is_ok());
        assert!(find("evil").is_err());
        assert!(find("").is_err());
        assert!(find("TWELVEDATA").is_err());
    }

    #[test]
    fn ids_and_hosts_unique() {
        for (i, a) in PROVIDERS.iter().enumerate() {
            for b in &PROVIDERS[i + 1..] {
                assert_ne!(a.id, b.id);
                assert_ne!(a.host, b.host);
            }
        }
    }

    #[test]
    fn host_mismatch_rejected() {
        let p = find("twelvedata").unwrap();
        let ok = Url::parse("https://api.twelvedata.com/quote?symbol=EUR/USD").unwrap();
        assert!(check_url(p, &ok).is_ok());
        for bad in [
            "http://api.twelvedata.com/quote",
            "https://evil.com/?h=api.twelvedata.com",
            "https://api.twelvedata.com.evil.com/quote",
            "https://sub.api.twelvedata.com/quote",
            "https://api.twelvedata.com:8443/quote",
            "https://api.openweathermap.org/data/2.5/weather",
        ] {
            assert!(check_url(p, &Url::parse(bad).unwrap()).is_err(), "{bad}");
        }
    }

    #[test]
    fn header_auth_applied() {
        let p = find("twelvedata").unwrap();
        let mut url = Url::parse("https://api.twelvedata.com/quote?symbol=XAU/USD").unwrap();
        let before = url.clone();
        let header = apply(p, &mut url, "abc123");
        assert_eq!(header, Some(("Authorization", "apikey abc123".to_string())));
        assert_eq!(url, before, "başlık kullanan sağlayıcıda adres değişmemeli");
    }

    #[test]
    fn query_auth_applied_and_overrides_existing() {
        let p = find("openweathermap").unwrap();
        let mut url = Url::parse("https://api.openweathermap.org/data/2.5/weather?lat=1&APPID=forged&lon=2").unwrap();
        assert_eq!(apply(p, &mut url, "k&y"), None);
        let pairs: Vec<(String, String)> = url.query_pairs().map(|(k, v)| (k.into(), v.into())).collect();
        assert_eq!(
            pairs,
            vec![
                ("lat".into(), "1".into()),
                ("lon".into(), "2".into()),
                ("appid".into(), "k&y".into()),
            ]
        );
    }
}
