//! NVIDIA GPU izleme: sabit yoldaki `nvidia-smi.exe` çalıştırılır (kullanıcı girdisi yok), CSV çıktısı ayrıştırılır.

use serde::Serialize;

#[cfg(windows)]
const SMI_PATH: &str = r"C:\Windows\System32\nvidia-smi.exe";
#[cfg(windows)]
const SMI_ARGS: [&str; 2] = [
    "--query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total,power.draw,fan.speed",
    "--format=csv,noheader,nounits",
];

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuStats {
    pub name: String,
    pub temperature: Option<f64>,
    pub utilization: Option<f64>,
    /// MiB
    pub memory_used: Option<f64>,
    pub memory_total: Option<f64>,
    /// Watt
    pub power: Option<f64>,
    pub fan: Option<f64>,
}

fn num(s: &str) -> Option<f64> {
    s.trim().parse::<f64>().ok().filter(|v| v.is_finite())
}

/// İlk GPU satırını ayrıştırır. "[N/A]" gibi değerler None olur.
pub fn parse_smi(csv: &str) -> Option<GpuStats> {
    let line = csv.lines().map(str::trim).find(|l| !l.is_empty())?;
    let parts: Vec<&str> = line.split(',').map(str::trim).collect();
    if parts.len() < 7 || parts[0].is_empty() {
        return None;
    }
    Some(GpuStats {
        name: parts[0].to_string(),
        temperature: num(parts[1]),
        utilization: num(parts[2]),
        memory_used: num(parts[3]),
        memory_total: num(parts[4]),
        power: num(parts[5]),
        fan: num(parts[6]),
    })
}

#[cfg(windows)]
fn run_smi() -> Result<String, String> {
    use std::io::Read;
    use std::os::windows::process::CommandExt;
    use std::process::{Command, Stdio};
    use std::time::{Duration, Instant};

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    if !std::path::Path::new(SMI_PATH).exists() {
        return Err("NO_DRIVER".into());
    }
    let mut child = Command::new(SMI_PATH)
        .args(SMI_ARGS)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|_| "NO_DRIVER".to_string())?;
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if start.elapsed() > Duration::from_secs(5) => {
                let _ = child.kill();
                return Err("TIMEOUT".into());
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(30)),
            Err(e) => return Err(e.to_string()),
        }
    }
    let mut out = String::new();
    if let Some(mut s) = child.stdout.take() {
        let _ = s.read_to_string(&mut out);
    }
    Ok(out)
}

/// NVIDIA GPU durumu; sürücü yoksa "NO_DRIVER" hatası.
#[tauri::command]
pub async fn gpu_stats() -> Result<GpuStats, String> {
    #[cfg(windows)]
    {
        let out = tauri::async_runtime::spawn_blocking(run_smi).await.map_err(|e| e.to_string())??;
        parse_smi(&out).ok_or_else(|| "NO_DRIVER".to_string())
    }
    #[cfg(not(windows))]
    {
        Err("NO_DRIVER".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_normal_line() {
        let g = parse_smi("NVIDIA GeForce RTX 4070, 54, 12, 1650, 12282, 38.45, 30\r\n").unwrap();
        assert_eq!(g.name, "NVIDIA GeForce RTX 4070");
        assert_eq!(g.temperature, Some(54.0));
        assert_eq!(g.utilization, Some(12.0));
        assert_eq!(g.memory_total, Some(12282.0));
        assert_eq!(g.power, Some(38.45));
        assert_eq!(g.fan, Some(30.0));
    }

    #[test]
    fn na_values_become_none() {
        let g = parse_smi("NVIDIA Laptop GPU, 60, 5, 100, 6144, [N/A], [N/A]").unwrap();
        assert_eq!(g.power, None);
        assert_eq!(g.fan, None);
        assert_eq!(g.temperature, Some(60.0));
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse_smi("").is_none());
        assert!(parse_smi("NVIDIA-SMI has failed because it couldn't communicate").is_none());
    }
}
