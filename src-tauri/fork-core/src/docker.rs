use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerStatus {
    pub available: bool,
    pub version: Option<String>,
    pub message: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContainerStatus {
    pub exists: bool,
    pub running: bool,
    pub started_at: Option<String>,
}

pub struct RunSpec {
    pub container_name: String,
    pub image: String,
    pub fork_config_dir: PathBuf,
    pub snapshot_dir: PathBuf,
    pub index_path: PathBuf,
    pub state_volume: String,
    pub env: Vec<(String, String)>,
    pub command: Vec<String>,
}

pub fn probe() -> DockerStatus {
    match run_docker(&["info", "--format", "{{.ServerVersion}}"]) {
        Ok(version) => DockerStatus {
            available: true,
            version: Some(version.trim().to_string()),
            message: None,
        },
        Err(error) => DockerStatus {
            available: false,
            version: None,
            message: Some(error),
        },
    }
}

pub fn run(spec: &RunSpec) -> Result<(), String> {
    if container_exists(&spec.container_name)? {
        Err("同名容器已存在，请先停止并删除。".into())
    } else {
        let mut args: Vec<String> = vec![
            "run".into(),
            "-d".into(),
            "--name".into(),
            spec.container_name.clone(),
            "--restart".into(),
            "unless-stopped".into(),
            "--read-only".into(),
            "--cap-drop".into(),
            "ALL".into(),
            "--security-opt".into(),
            "no-new-privileges:true".into(),
            "--pids-limit".into(),
            "256".into(),
            "--user".into(),
            "10000:10000".into(),
            "--entrypoint".into(),
            "/opt/fork/entrypoint.sh".into(),
            "--mount".into(),
            format!("type=volume,src={},dst=/opt/data", spec.state_volume),
            "--mount".into(),
            format!(
                "type=bind,src={},dst=/knowledge,readonly",
                spec.snapshot_dir.display()
            ),
            "--mount".into(),
            format!(
                "type=bind,src={},dst=/run/secrets/fork-public-index,readonly",
                spec.index_path.display()
            ),
            "--mount".into(),
            format!(
                "type=bind,src={},dst=/fork-config,readonly",
                spec.fork_config_dir.display()
            ),
            "--tmpfs".into(),
            "/run:rw,nosuid,nodev,size=16m".into(),
            "--tmpfs".into(),
            "/tmp:rw,nosuid,nodev,noexec,size=128m".into(),
            "-e".into(),
            "HERMES_HOME=/opt/data".into(),
            "-e".into(),
            "HOME=/opt/data".into(),
            "-e".into(),
            "HERMES_ENABLE_PROJECT_PLUGINS=false".into(),
            "-e".into(),
            "FORK_KNOWLEDGE_INDEX=/run/secrets/fork-public-index".into(),
        ];
        for (key, value) in &spec.env {
            args.push("-e".into());
            args.push(format!("{}={}", key, value));
        }
        args.push(spec.image.clone());
        args.extend(spec.command.iter().cloned());
        run_docker_owned(&args).map(|_| ())
    }
}

pub fn stop(container_name: &str) -> Result<(), String> {
    run_docker(&["stop", container_name]).map(|_| ())
}

pub fn remove(container_name: &str) -> Result<(), String> {
    run_docker(&["rm", "-f", container_name]).map(|_| ())
}

pub fn status(container_name: &str) -> Result<ContainerStatus, String> {
    match run_docker(&[
        "inspect",
        "--format",
        "{{.State.Running}}|{{.State.StartedAt}}",
        container_name,
    ]) {
        Ok(output) => {
            let output = output.trim();
            let mut parts = output.splitn(2, '|');
            let running = parts.next() == Some("true");
            let started_at = parts.next().map(|value| value.to_string());
            Ok(ContainerStatus {
                exists: true,
                running,
                started_at,
            })
        }
        Err(error) => {
            if error.contains("No such") || error.contains("no such") {
                Ok(ContainerStatus {
                    exists: false,
                    running: false,
                    started_at: None,
                })
            } else {
                Err(error)
            }
        }
    }
}

pub fn logs(container_name: &str, tail: usize) -> Result<String, String> {
    run_docker(&["logs", "--tail", &tail.to_string(), container_name])
}

pub fn remove_volume(volume: &str) -> Result<(), String> {
    run_docker(&["volume", "rm", volume]).map(|_| ())
}

fn container_exists(container_name: &str) -> Result<bool, String> {
    Ok(status(container_name)?.exists)
}

fn run_docker(args: &[&str]) -> Result<String, String> {
    let output = Command::new("docker")
        .args(args)
        .output()
        .map_err(|error| format!("无法执行 docker，请确认已安装并启动 Docker Desktop：{}", error))?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(message);
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn run_docker_owned(args: &[String]) -> Result<String, String> {
    let output = Command::new("docker")
        .args(args)
        .output()
        .map_err(|error| format!("无法执行 docker，请确认已安装并启动 Docker Desktop：{}", error))?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(message);
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
