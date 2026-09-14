use bech32::{Bech32, Hrp};
use secp256k1::{rand, Secp256k1, SecretKey};
use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use zeroize::Zeroizing;

#[cfg(unix)]
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GenerateResult {
    identity_name: String,
    public_key: String,
    public_path: String,
    private_path: String,
}

fn encode_key(prefix: &str, bytes: &[u8]) -> String {
    let hrp = Hrp::parse(prefix).expect("fixed NIP-19 prefix must be valid");
    bech32::encode::<Bech32>(hrp, bytes).expect("32-byte NIP-19 key must encode")
}

fn normalize_name(input: &str) -> Result<String, String> {
    let name = input.trim();
    if name.is_empty() {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "系统时间不可用。".to_string())?
            .as_millis();
        return Ok(format!("buzz-member-{timestamp}"));
    }

    let valid = name.len() <= 64
        && name
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_alphanumeric())
        && name.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
        });
    if !valid {
        return Err("身份名称只能包含字母、数字、点、下划线和短横线，且必须以字母或数字开头。".to_string());
    }
    Ok(name.to_string())
}

fn write_key_file(path: &Path, value: &[u8]) -> Result<(), String> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    options.mode(0o600);

    let mut file = options
        .open(path)
        .map_err(|error| format!("无法创建密钥文件：{error}"))?;
    file.write_all(value)
        .map_err(|error| format!("无法写入密钥文件：{error}"))
}

fn create_identity(target: &Path, identity_name: String) -> Result<GenerateResult, String> {
    let secp = Secp256k1::new();
    let mut secret_key = SecretKey::new(&mut rand::rng());
    let secret_bytes = Zeroizing::new(secret_key.secret_bytes());
    let (x_only_public_key, _) = secret_key.x_only_public_key(&secp);
    let public_key = encode_key("npub", &x_only_public_key.serialize());
    let private_key = Zeroizing::new(encode_key("nsec", secret_bytes.as_ref()));

    let public_path = target.join("public.key");
    let private_path = target.join("private.key");
    let write_result = (|| {
        write_key_file(&private_path, private_key.as_bytes())?;
        write_key_file(&public_path, public_key.as_bytes())?;
        Ok(GenerateResult {
            identity_name,
            public_key,
            public_path: public_path.to_string_lossy().into_owned(),
            private_path: private_path.to_string_lossy().into_owned(),
        })
    })();

    secret_key.non_secure_erase();
    write_result
}

#[tauri::command]
fn generate_identity(name: String, directory: String) -> Result<GenerateResult, String> {
    if directory.trim().is_empty() {
        return Err("请先选择保存位置。".to_string());
    }

    let parent = PathBuf::from(directory);
    if !parent.is_dir() {
        return Err("选择的保存位置不存在。".to_string());
    }

    let identity_name = normalize_name(&name)?;
    let target = parent.join(&identity_name);
    fs::create_dir(&target).map_err(|error| {
        if error.kind() == std::io::ErrorKind::AlreadyExists {
            "该身份名称已经存在，请换一个名称。".to_string()
        } else {
            format!("无法创建身份目录：{error}")
        }
    })?;

    #[cfg(unix)]
    if let Err(error) = fs::set_permissions(&target, fs::Permissions::from_mode(0o700)) {
        let _ = fs::remove_dir(&target);
        return Err(format!("无法设置身份目录权限：{error}"));
    }

    match create_identity(&target, identity_name) {
        Ok(result) => Ok(result),
        Err(error) => {
            let _ = fs::remove_file(target.join("private.key"));
            let _ = fs::remove_file(target.join("public.key"));
            let _ = fs::remove_dir(&target);
            Err(error)
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![generate_identity])
        .run(tauri::generate_context!())
        .expect("error while running Buzz Identity");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_nip19_vectors() {
        let public = hex("7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e");
        let private = hex("67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa");
        assert_eq!(
            encode_key("npub", &public),
            "npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg"
        );
        assert_eq!(
            encode_key("nsec", &private),
            "nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5"
        );
    }

    #[test]
    fn writes_keys_once_with_private_permissions() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("buzz-identity-test-{unique}"));
        fs::create_dir(&root).unwrap();

        let result = generate_identity(
            "teammate-test".to_string(),
            root.to_string_lossy().into_owned(),
        )
        .unwrap();
        assert!(result.public_key.starts_with("npub1"));
        assert_eq!(fs::read_to_string(&result.public_path).unwrap(), result.public_key);
        let private = Zeroizing::new(fs::read_to_string(&result.private_path).unwrap());
        assert!(private.starts_with("nsec1"));

        #[cfg(unix)]
        {
            assert_eq!(fs::metadata(&result.public_path).unwrap().permissions().mode() & 0o777, 0o600);
            assert_eq!(fs::metadata(&result.private_path).unwrap().permissions().mode() & 0o777, 0o600);
        }

        assert!(generate_identity("teammate-test".to_string(), root.to_string_lossy().into_owned()).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    fn hex(value: &str) -> Vec<u8> {
        value
            .as_bytes()
            .chunks_exact(2)
            .map(|pair| {
                let text = std::str::from_utf8(pair).unwrap();
                u8::from_str_radix(text, 16).unwrap()
            })
            .collect()
    }
}
