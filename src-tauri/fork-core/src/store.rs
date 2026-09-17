use crate::snapshot::KnowledgeSource;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub const KEYRING_SERVICE: &str = "buzz-identity-fork";

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Persona {
    pub soul: String,
    pub skill: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfig {
    pub provider: String,
    pub model: String,
    #[serde(default)]
    pub base_url: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuzzConfig {
    pub relay_url: String,
    pub home_channel: String,
}

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeState {
    #[serde(default)]
    pub snapshot_id: Option<String>,
    #[serde(default)]
    pub state: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForkConfig {
    pub id: String,
    pub name: String,
    pub created_at: u64,
    pub identity_id: String,
    #[serde(default)]
    pub domain: Option<String>,
    pub persona: Persona,
    pub knowledge_sources: Vec<KnowledgeSource>,
    pub model: ModelConfig,
    pub buzz: BuzzConfig,
    #[serde(default)]
    pub runtime: RuntimeState,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForkSummary {
    pub id: String,
    pub name: String,
    pub created_at: u64,
    pub identity_id: String,
    pub state: String,
    pub has_model_key: bool,
}

pub fn fork_dir(root: &Path, id: &str) -> Result<PathBuf, String> {
    validate_id(id)?;
    Ok(root.join(id))
}

pub fn create_fork_at(root: &Path, config: &ForkConfig) -> Result<(), String> {
    let dir = fork_dir(root, &config.id)?;
    if dir.exists() {
        return Err("分身 ID 已存在。".into());
    }
    fs::create_dir_all(dir.join("config")).map_err(|error| error.to_string())?;
    write_config_at(root, config)
}

pub fn read_fork_at(root: &Path, id: &str) -> Result<ForkConfig, String> {
    let path = fork_dir(root, id)?.join("fork.json");
    let text = fs::read_to_string(&path).map_err(|_| "分身配置不存在。".to_string())?;
    serde_json::from_str(&text).map_err(|_| "分身配置已损坏。".to_string())
}

pub fn write_config_at(root: &Path, config: &ForkConfig) -> Result<(), String> {
    let dir = fork_dir(root, &config.id)?;
    if !dir.exists() {
        return Err("分身不存在。".into());
    }
    let mut text = serde_json::to_string_pretty(config).map_err(|error| error.to_string())?;
    text.push('\n');
    fs::write(dir.join("fork.json"), text).map_err(|error| error.to_string())
}

pub fn list_forks_at(root: &Path) -> Result<Vec<ForkConfig>, String> {
    let mut forks = Vec::new();
    if !root.exists() {
        return Ok(forks);
    }
    let entries = fs::read_dir(root).map_err(|error| error.to_string())?;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if let Ok(config) = read_fork_at(root, &name) {
            forks.push(config);
        }
    }
    forks.sort_by_key(|config| config.created_at);
    Ok(forks)
}

pub fn delete_fork_at(root: &Path, id: &str) -> Result<(), String> {
    let dir = fork_dir(root, id)?;
    if !dir.exists() {
        return Err("分身不存在。".into());
    }
    fs::remove_dir_all(dir).map_err(|error| error.to_string())
}

pub fn write_mount_config(root: &Path, config: &ForkConfig) -> Result<PathBuf, String> {
    let dir = fork_dir(root, &config.id)?;
    let config_dir = dir.join("config");
    fs::create_dir_all(&config_dir).map_err(|error| error.to_string())?;
    fs::write(config_dir.join("SOUL.md"), &config.persona.soul).map_err(|error| error.to_string())?;
    fs::write(config_dir.join("SKILL.md"), &config.persona.skill).map_err(|error| error.to_string())?;
    let mut overlay = serde_json::json!({
        "model": {
            "provider": config.model.provider,
            "default": config.model.model,
        }
    });
    if let Some(base_url) = &config.model.base_url {
        overlay["model"]["base_url"] = serde_json::Value::String(base_url.clone());
    }
    let mut text = serde_json::to_string_pretty(&overlay).map_err(|error| error.to_string())?;
    text.push('\n');
    fs::write(config_dir.join("config.json"), text).map_err(|error| error.to_string())?;
    Ok(config_dir)
}

pub fn model_key_user(id: &str) -> String {
    format!("{}:model", id)
}

pub fn set_model_key(id: &str, key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &model_key_user(id)).map_err(|error| error.to_string())?;
    entry.set_password(key).map_err(|error| format!("无法写入系统凭据存储：{}", error))
}

pub fn get_model_key(id: &str) -> Result<String, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &model_key_user(id)).map_err(|error| error.to_string())?;
    entry
        .get_password()
        .map_err(|_| "该分身尚未设置模型 API Key。".to_string())
}

pub fn delete_model_key(id: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &model_key_user(id)).map_err(|error| error.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

pub fn has_model_key(id: &str) -> bool {
    get_model_key(id).is_ok()
}

fn validate_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 64
        || !id.bytes().all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return Err("分身 ID 非法。".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn temp_root(name: &str) -> PathBuf {
        let unique = COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!(
            "fork-store-test-{}-{}-{}",
            name,
            std::process::id(),
            unique
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn sample(id: &str) -> ForkConfig {
        ForkConfig {
            id: id.into(),
            name: "测试分身".into(),
            created_at: 1,
            identity_id: "identity-1".into(),
            domain: Some("测试知识域".into()),
            persona: Persona {
                soul: "# SOUL\n".into(),
                skill: "# SKILL\n".into(),
            },
            knowledge_sources: vec![KnowledgeSource::Folder {
                label: "docs".into(),
                path: PathBuf::from("/tmp/docs"),
                include: vec![],
            }],
            model: ModelConfig {
                provider: "deepseek".into(),
                model: "deepseek-flash".into(),
                base_url: Some("https://api.deepseek.com/v1".into()),
            },
            buzz: BuzzConfig {
                relay_url: "https://buzz.example".into(),
                home_channel: "chan-1".into(),
            },
            runtime: RuntimeState::default(),
        }
    }

    #[test]
    fn roundtrips_fork_config() {
        let root = temp_root("roundtrip");
        let config = sample("fork-a1");
        create_fork_at(&root, &config).unwrap();
        let loaded = read_fork_at(&root, "fork-a1").unwrap();
        assert_eq!(loaded.name, "测试分身");
        assert_eq!(loaded.domain.as_deref(), Some("测试知识域"));
        assert_eq!(loaded.model.model, "deepseek-flash");
        assert_eq!(list_forks_at(&root).unwrap().len(), 1);
        delete_fork_at(&root, "fork-a1").unwrap();
        assert!(list_forks_at(&root).unwrap().is_empty());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn reads_legacy_config_without_domain() {
        let root = temp_root("legacy");
        let config = sample("fork-c3");
        create_fork_at(&root, &config).unwrap();
        let path = fork_dir(&root, "fork-c3").unwrap().join("fork.json");
        let mut legacy = serde_json::to_value(config).unwrap();
        legacy.as_object_mut().unwrap().remove("domain");
        fs::write(&path, serde_json::to_vec(&legacy).unwrap()).unwrap();

        assert_eq!(read_fork_at(&root, "fork-c3").unwrap().domain, None);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn writes_mount_config_overlay() {
        let root = temp_root("mount");
        let config = sample("fork-b2");
        create_fork_at(&root, &config).unwrap();
        let dir = write_mount_config(&root, &config).unwrap();
        assert!(dir.join("SOUL.md").exists());
        assert!(dir.join("SKILL.md").exists());
        let overlay: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(dir.join("config.json")).unwrap()).unwrap();
        assert_eq!(overlay["model"]["provider"], "deepseek");
        assert_eq!(overlay["model"]["base_url"], "https://api.deepseek.com/v1");
        assert!(overlay.get("plugins").is_none());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn rejects_path_traversal_ids() {
        let root = temp_root("traversal");
        assert!(fork_dir(&root, "../escape").is_err());
        assert!(fork_dir(&root, "a/b").is_err());
        assert!(fork_dir(&root, "UPPER").is_err());
        let _ = fs::remove_dir_all(&root);
    }
}
