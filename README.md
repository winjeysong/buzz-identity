# Buzz Identity

为 Buzz 自托管成员在本机生成独立 Nostr 身份。应用只展示公钥，私钥由 Rust 后端直接写入用户选择的目录。

## 下载客户端

每次推送到 `main` 分支后，GitHub Actions 会构建以下安装包，可在对应工作流的 Artifacts 中下载：

- Windows x64：NSIS `.exe`
- macOS Apple Silicon：`.dmg`
- macOS Intel：`.dmg`

安装包暂未配置商业代码签名。macOS 首次打开时可能需要在“隐私与安全性”中手动允许。

## Docker 构建

```bash
docker build --output type=local,dest=dist/linux .
```

产物位于 `dist/linux/`。Docker 仅用于可选的 Linux 构建；Windows 与 macOS 由 GitHub Actions 原生构建。
