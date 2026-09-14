const form = document.querySelector("#identity-form");
const nameInput = document.querySelector("#identity-name");
const chooseButton = document.querySelector("#choose-directory");
const generateButton = document.querySelector("#generate");
const directoryPath = document.querySelector("#directory-path");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const resultName = document.querySelector("#result-name");
const publicKey = document.querySelector("#public-key");
const publicPath = document.querySelector("#public-path");
const privatePath = document.querySelector("#private-path");
const copyButton = document.querySelector("#copy-public-key");

let selectedDirectory = "";

function showStatus(message, kind = "") {
  status.textContent = message;
  status.className = `status ${kind}`.trim();
}

async function chooseDirectory() {
  const selected = await window.__TAURI__.dialog.open({
    directory: true,
    multiple: false,
    title: "选择密钥保存位置",
  });
  if (typeof selected === "string") {
    selectedDirectory = selected;
    directoryPath.textContent = selected;
    showStatus("");
  }
  return selectedDirectory;
}

chooseButton.addEventListener("click", async () => {
  try {
    await chooseDirectory();
  } catch (error) {
    showStatus(`无法打开文件夹选择器：${String(error)}`, "error");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    if (!selectedDirectory && !(await chooseDirectory())) return;

    generateButton.disabled = true;
    result.hidden = true;
    showStatus("正在本机生成密钥…", "working");

    const generated = await window.__TAURI__.core.invoke("generate_identity", {
      name: nameInput.value,
      directory: selectedDirectory,
    });

    resultName.textContent = generated.identityName;
    publicKey.textContent = generated.publicKey;
    publicPath.textContent = generated.publicPath;
    privatePath.textContent = generated.privatePath;
    result.hidden = false;
    showStatus("生成完成。", "success");
  } catch (error) {
    showStatus(String(error), "error");
  } finally {
    generateButton.disabled = false;
  }
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(publicKey.textContent);
    showStatus("公钥已复制。", "success");
  } catch {
    showStatus("复制失败，请手动选择公钥。", "error");
  }
});
