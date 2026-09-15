# Artpal Buzz Identity

为 Buzz 自托管成员在本机生成并管理 Nostr 身份。身份记录和密钥自动保存在系统应用数据目录中，支持查看和复制 NIP-19、64 位 Hex 格式，以及重命名和删除。

## 下载客户端

每次推送到 `main` 分支后，GitHub Actions 会读取应用版本并创建对应的 `v<版本号>` Release：

- Windows x64：NSIS `.exe`
- macOS Apple Silicon：`.dmg`
- macOS Intel：`.dmg`

发布新版本前需更新 `src-tauri/tauri.conf.json` 中的 `version`。

安装包暂未配置商业代码签名。macOS 首次打开时可能需要在“隐私与安全性”中手动允许。

## Docker 构建

```bash
docker build --output type=local,dest=dist/linux .
```

产物位于 `dist/linux/`。Docker 仅用于可选的 Linux 构建；Windows 与 macOS 由 GitHub Actions 原生构建。
