//! Denetimli HTTP GET katmanı. Webview doğrudan ağa çıkmaz; tüm istekler buradan geçer.
//! - Yalnızca http/https, yalnızca GET
//! - 30 sn zaman aşımı (bazı resmî sunucularda ilk bağlantı ~9 sn sürüyor), 5 MB gövde sınırı, en fazla 5 yönlendirme
//! - ETag / Last-Modified ile koşullu istek (gereksiz indirmeyi önler)
//! - Anahtar gerektiren sağlayıcılarda anahtar Rust tarafında eklenir (`providers.rs` tablosu);
//!   bu istekler yönlendirme izlemez ve hata metinlerinde adres (dolayısıyla anahtar) yer almaz

use std::time::Duration;

use reqwest::{header, Client, StatusCode};
use serde::{Deserialize, Serialize};
use url::Url;

use crate::{providers, secrets};

const MAX_BODY: usize = 5 * 1024 * 1024;

pub struct NetState {
    client: Client,
    /// Anahtarlı istekler için: yönlendirme yok (anahtar başka sunucuya taşınamasın).
    provider_client: Client,
}

impl NetState {
    pub fn new() -> Result<Self, String> {
        let build = |redirect: reqwest::redirect::Policy| {
            Client::builder()
                .user_agent(concat!("Alpicim/", env!("CARGO_PKG_VERSION"), " (Windows masaustu; RSS okuyucu)"))
                .timeout(Duration::from_secs(30))
                .connect_timeout(Duration::from_secs(20))
                .redirect(redirect)
                .build()
                .map_err(|e| e.to_string())
        };
        Ok(Self {
            client: build(reqwest::redirect::Policy::limited(5))?,
            provider_client: build(reqwest::redirect::Policy::none())?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetRequest {
    pub url: String,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    /// Anahtar gerektiren sağlayıcı kimliği (ör. "twelvedata").
    pub provider: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetResponse {
    pub status: u16,
    pub ok: bool,
    pub not_modified: bool,
    pub body: String,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub content_type: Option<String>,
}

pub fn validate_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw.trim()).map_err(|_| "Geçersiz adres".to_string())?;
    match url.scheme() {
        "http" | "https" => {}
        other => return Err(format!("Desteklenmeyen protokol: {other}")),
    }
    if url.host_str().unwrap_or("").is_empty() {
        return Err("Adreste sunucu yok".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Adreste kullanıcı bilgisi olamaz".into());
    }
    Ok(url)
}

fn header_string(headers: &header::HeaderMap, name: header::HeaderName) -> Option<String> {
    headers.get(name).and_then(|v| v.to_str().ok()).map(str::to_string)
}

/// Gövdeyi doğru karakter kodlamasıyla çözer (ör. bazı Türkçe kaynaklar ISO-8859-9 kullanır).
pub fn decode_body(bytes: &[u8], content_type: Option<&str>) -> String {
    let from_header = content_type.and_then(|ct| {
        ct.split(';')
            .map(str::trim)
            .find_map(|p| p.strip_prefix("charset=").or_else(|| p.strip_prefix("CHARSET=")))
            .map(|c| c.trim_matches('"').to_string())
    });
    let from_xml = || {
        let head = String::from_utf8_lossy(&bytes[..bytes.len().min(256)]).to_string();
        let start = head.find("encoding=")? + "encoding=".len();
        let rest = &head[start..];
        let quote = rest.chars().next()?;
        if quote != '"' && quote != '\'' {
            return None;
        }
        let end = rest[1..].find(quote)?;
        Some(rest[1..1 + end].to_string())
    };
    let label = from_header.or_else(from_xml);
    let encoding = label
        .and_then(|l| encoding_rs::Encoding::for_label(l.as_bytes()))
        .unwrap_or(encoding_rs::UTF_8);
    let (text, _, _) = encoding.decode(bytes);
    text.into_owned()
}

#[tauri::command]
pub async fn net_get(
    state: tauri::State<'_, NetState>,
    request: NetRequest,
) -> Result<NetResponse, String> {
    let mut url = validate_url(&request.url)?;
    let provider = request.provider.as_deref().map(providers::find).transpose()?;
    let mut auth_header: Option<(&'static str, header::HeaderValue)> = None;
    if let Some(p) = provider {
        providers::check_url(p, &url)?;
        let key = secrets::get(p.id).ok_or("API_KEY_MISSING")?;
        if let Some((name, value)) = providers::apply(p, &mut url, &key) {
            let mut value = header::HeaderValue::from_str(&value).map_err(|_| "Geçersiz anahtar")?;
            value.set_sensitive(true);
            auth_header = Some((name, value));
        }
    }
    let keyed = provider.is_some();
    let client = if keyed { &state.provider_client } else { &state.client };
    let mut builder = client.get(url);
    if let Some((name, value)) = auth_header {
        builder = builder.header(name, value);
    }
    if let Some(etag) = request.etag.as_deref() {
        builder = builder.header(header::IF_NONE_MATCH, etag);
    }
    if let Some(lm) = request.last_modified.as_deref() {
        builder = builder.header(header::IF_MODIFIED_SINCE, lm);
    }

    // Anahtarlı isteklerde hata metnine adres yazılmaz (sorgu parametresindeki anahtar sızmasın).
    let scrub = |e: reqwest::Error| if keyed { e.without_url() } else { e };
    let mut response = builder.send().await.map_err(|e| {
        if e.is_timeout() {
            "NETWORK_TIMEOUT".to_string()
        } else if e.is_connect() {
            "NETWORK_OFFLINE".to_string()
        } else {
            format!("NETWORK_ERROR: {}", scrub(e))
        }
    })?;

    let status = response.status();
    let headers = response.headers().clone();
    let content_type = header_string(&headers, header::CONTENT_TYPE);
    let etag = header_string(&headers, header::ETAG);
    let last_modified = header_string(&headers, header::LAST_MODIFIED);

    if status == StatusCode::NOT_MODIFIED {
        return Ok(NetResponse {
            status: status.as_u16(),
            ok: true,
            not_modified: true,
            body: String::new(),
            etag,
            last_modified,
            content_type,
        });
    }

    if response.content_length().is_some_and(|len| len as usize > MAX_BODY) {
        return Err("Yanıt çok büyük".into());
    }
    let mut bytes: Vec<u8> = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| format!("NETWORK_ERROR: {}", scrub(e)))? {
        if bytes.len() + chunk.len() > MAX_BODY {
            return Err("Yanıt çok büyük".into());
        }
        bytes.extend_from_slice(&chunk);
    }

    Ok(NetResponse {
        status: status.as_u16(),
        ok: status.is_success(),
        not_modified: false,
        body: decode_body(&bytes, content_type.as_deref()),
        etag,
        last_modified,
        content_type,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_http_urls() {
        assert!(validate_url("file:///C:/Windows/win.ini").is_err());
        assert!(validate_url("javascript:alert(1)").is_err());
        assert!(validate_url("https://user:pw@example.com/").is_err());
        assert!(validate_url("https://news.google.com/rss").is_ok());
    }

    #[test]
    fn decodes_turkish_legacy_encoding() {
        // "Şiir" ISO-8859-9 ile: Ş = 0xDE
        let bytes = b"<?xml version=\"1.0\" encoding=\"ISO-8859-9\"?><t>\xDEiir</t>";
        let text = decode_body(bytes, Some("text/xml"));
        assert!(text.contains("Şiir"));
    }

    #[test]
    fn header_charset_wins() {
        let text = decode_body("çay".as_bytes(), Some("application/rss+xml; charset=utf-8"));
        assert_eq!(text, "çay");
    }
}
