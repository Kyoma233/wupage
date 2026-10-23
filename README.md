<div align="center">
  <img src="public/icons/icon-128.png" width="96" height="96" alt="WuPage Translator" />
  <h1>WuPage Translator</h1>
  <p><strong>在原网页上下文中阅读译文，也能把 PDF 变成可编辑的双语文档。</strong></p>
  <p>
    面向 Chrome 与 Microsoft Edge 的 Manifest V3 翻译扩展，支持多种翻译服务、细粒度性能配置与本地缓存。
  </p>
  <p>
    <a href="https://wupage.mrwuliu.top/">项目主页</a> ·
    <a href="https://github.com/mr-wuliu/wupage/releases/latest">下载最新版</a> ·
    <a href="https://github.com/mr-wuliu/wupage/issues">问题反馈</a> ·
    <a href="PRIVACY.md">隐私政策</a>
  </p>
  <p>
    <a href="https://github.com/mr-wuliu/wupage/releases"><img src="https://img.shields.io/github/v/release/mr-wuliu/wupage?include_prereleases&sort=semver" alt="GitHub Release" /></a>
    <a href="https://github.com/mr-wuliu/wupage/actions/workflows/release.yml"><img src="https://github.com/mr-wuliu/wupage/actions/workflows/release.yml/badge.svg" alt="Release build" /></a>
    <img src="https://img.shields.io/badge/Manifest-V3-4285F4" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5.9" />
  </p>
</div>

## 为什么选择 WuPage

WuPage 不只替换一整页文字。它尽可能保留网页原有的排版与交互，在原文旁插入译文，并对动态加载内容持续工作。遇到 PDF 时，则切换到独立的双栏工作区，让阅读、校对和导出形成一条完整流程。

| 能力 | 说明 |
| --- | --- |
| 网页翻译显示 | 支持“译文替换”“原色对照”“双色对照”三种模式；可随时恢复原文 |
| 段落模式 | 开启后按住 `Ctrl` 点击目标段落，只翻译真正需要的内容 |
| 动态页面支持 | 按可见区域渐进处理，并继续识别滚动或异步加载的新内容 |
| 图片覆盖翻译 | 开启图片翻译后，点击图片旁的「译」按钮，在原文字区域覆盖译文；可切回原图 |
| PDF 双栏工作区 | 支持在线 PDF、本地文件和 PDF URL，原文与译文按页对齐 |
| PDF 译文编辑 | 可直接编辑、移动、缩放或删除译文块，并下载调整后的译文 PDF |
| 多服务商架构 | 从免密钥服务、主流云翻译到 OpenAI / Anthropic 兼容 LLM 与自定义 HTTP 接口 |
| 性能与可靠性 | 支持分块、并发、失败拆分重试、请求超时、任务调试和本地翻译缓存 |
| 本地优先 | 不经过 WuPage 自建代理；配置、密钥与缓存保存在浏览器扩展的本地存储中 |

## 安装

### 从 Release 安装

1. 前往 [Releases](https://github.com/mr-wuliu/wupage/releases/latest) 下载最新的 `wupage-<version>-edge.zip`。
2. 解压 ZIP 文件。
3. 打开 `edge://extensions` 或 `chrome://extensions`，开启「开发人员模式」。
4. 选择「加载解压缩的扩展」，并选择包含 `manifest.json` 的解压目录。

发布包以 Edge 命名，但同样基于 Chromium Manifest V3，可在 Chrome 中以开发者模式加载。

### 从源码构建

需要 Node.js 22 或更高版本，以及 npm。

```bash
git clone https://github.com/mr-wuliu/wupage.git
cd wupage
npm ci
npm run build
```

构建完成后，按照上面的方式加载 `dist/` 目录。

## 快速上手

1. 点击浏览器工具栏中的 WuPage 图标。
2. 选择源语言、目标语言和翻译服务。默认的 Google Web Translate 无需 API Key。
3. 点击「翻译全文」开始双语阅读；再次点击即可显示原文。
4. 如果只想翻译局部内容，开启「段落模式」，按住 `Ctrl` 点击段落。
5. 弹窗仅显示一个翻译按钮：网页显示「翻译全文」，在线或本地 PDF 显示「翻译PDF」。点击后分别翻译当前网页，或打开 PDF 双栏工作区并开始翻译。

全文翻译也会读取图片中提供的长段替代文字（`alt`）。对于能可靠识别段落间隔的透明文字图片，会按段显示原图文字与对应译文，保留原有字形和页面背景；译文替换模式只显示译文。普通图片仍保留原图，在下方显示翻译后的说明。恢复原文时还原原图。这不需要 OCR；没有提供这类文字的图片仍需使用图片翻译。

更完整的服务商参数、缓存和性能选项位于扩展的「设置」页面。悬浮球可在不打开弹窗的情况下访问常用操作，Debug 面板则会显示翻译任务、请求状态与错误信息。

### 图片覆盖翻译

在弹窗或设置的「图片翻译」旁点击扳手，下载并安装约 20.5 MB 的 PaddleOCR 轻量模型。悬停或点击「？」可查看使用说明、下载进度与安装状态。文件校验和加载成功后，扳手变成垃圾桶，图片翻译开关才可启用。安装在后台进行，关闭弹窗不会中断；失败时可点击扳手重试。

- 开启后，将鼠标移到网页图片上，再点击出现的「译」按钮。移开鼠标会隐藏按钮，但保留已生成的译文。OCR 在本地识别文字和位置，当前翻译服务只接收文字，无需具备图片输入能力。译文按 OCR 位置覆盖，纯数字、百分比、倍率和常见数量缩写保持原样。
- 也可以右键点击图片，选择「使用 WuPage 翻译图片」。适用于 X 帖子等悬浮按钮被遮挡的场景；译文仍覆盖在点击的原图上。再次选择会显示已有译文，不会重复翻译。尚未安装 OCR 或开启图片翻译时会打开设置指引；扩展更新后，已打开的网页需要刷新。
- 点击「原」可查看原图，再次点击「译」可恢复译图；关闭开关会移除覆盖层，但保留模型。点击垃圾桶会删除本地模型并关闭图片翻译，可重新安装。原始图片文件和链接不会被修改。
- 模型保存在此浏览器的扩展 Cache Storage 中，只有主动点击扳手才会下载。识别运行在独立的沙箱页面，闲置一分钟后释放运行实例；模型文件保留到用户删除或浏览器清理存储。OCR 运行库随扩展打包，不从远端加载执行代码。
- 开关默认关闭。启用缓存时仅保存文字区域与译文，不保存原始图片数据；「清除缓存」会清除图片翻译结果，不删除 OCR 模型。
- 当前支持网页中的静态 `<img>` 图片，过滤小图标；跨域图片通过扩展读取，要求图片可访问。鉴权、防盗链或特殊图片地址可能无法读取。超大图片会缩放，下载上限为 12 MB。
- 原文区域使用图片像素采样的背景色覆盖，透明底图片保留背景透明度与原字色。纯色背景效果更好；复杂纹理、斜排文字、密集小字和文字框定位可能不理想，目前不做背景无痕修复。动画、CSS 背景图、嵌入框架内部图片暂不保证支持。
- 当前 OCR 模型支持简体中文、繁体中文、英文和日文。透明图片会使用独立副本调整识别底色，不改变原图透明度；艺术字、混合竖排和低对比度文字仍可能漏识别。提示会区分识别失败、过滤后的空结果与译文未变化，空结果不会缓存。
- 对于宽幅透明文字图，同一行的相邻片段会合并翻译，并扫描原图补全覆盖范围内的引号、连接线和句号。图片的替代文字与识别出的全部字词一致时，使用它补全遗漏的标点。
- 本地视觉回归页：运行开发预览服务后打开 `tests/fixtures/image-preview.html`，使用固定模型结果检查覆盖、切换、缩放与内部滚动，不调用外部 API。
- OCR 实测页：先 `npm run build`，再 `node tests/fixtures/ocr-preview-server.mjs`，打开 `http://127.0.0.1:5175`，验证真实下载、安装、识别、状态持久化和删除。仅模拟扩展消息，OCR 模型、沙箱和校验使用生产实现。日文透明文字样例还支持真实翻译，以及使用固定译文的符号覆盖与断句回归。

## 翻译服务

| 服务类型 | 凭据 | 接口形式 | 备注 |
| --- | --- | --- | --- |
| Google Web Translate | 无需密钥 | 网页翻译接口 | 默认启用，适合快速开始 |
| Microsoft Translator | API Key，可选区域 | Azure Translator REST API | 使用自己的 Azure Translator 资源 |
| Google Cloud Translation | API Key | Translation Basic v2 | 使用自己的 Google Cloud 项目 |
| OpenAI Compatible | 视服务而定 | `/chat/completions` | 可配置 Base URL、模型和系统提示词 |
| DeepSeek | API Key | `/chat/completions` | 内置官方 API 预设，支持 `deepseek-flash` / `deepseek-v4-pro` |
| Zhipu GLM | API Key | Chat Completions | 内置智谱 GLM 预设 |
| Anthropic Compatible | 视服务而定 | `/messages` | 可作为自定义 LLM 服务添加 |
| HTTP Template | 视接口而定 | GET / POST | 自定义 URL、请求头、请求体和响应路径 |

> [!IMPORTANT]
> Google Web Translate 使用非官方网页接口，可能受到限流、地区限制或上游接口变更影响。需要稳定 SLA 时，建议配置正式云翻译服务或可信的自有接口。

### LLM 服务

DeepSeek 内置预设使用官方 API，默认模型为 `deepseek-flash`，也可选择 `deepseek-v4-pro`，并默认关闭思考模式以减少翻译延迟。旧 Flash 模型配置会自动迁移为 `deepseek-flash`，模型名称以 [DeepSeek 官方文档](https://api-docs.deepseek.com/zh-cn/) 为准。OpenAI Compatible 适用于 OpenAI、兼容 `/chat/completions` 的网关，以及其他采用相同请求格式的服务。Anthropic Compatible 支持 Messages API 格式。这些 LLM 服务都可以自定义 Base URL、API Key、模型与系统提示词。

LLM 返回值应为与输入顺序一致的 JSON 字符串数组。只有一个输入项时，也兼容单个字符串结果。

使用 Ollama 时，可填写 `http://[IPv6地址]:11434`、`http://[IPv6地址]:11434/v1` 或完整的 `/v1/chat/completions` 地址，扩展会补全接口并避免重复追加路径。IPv4、IPv6、主机名和自定义端口均支持。OpenAI Compatible 服务默认开启「Ollama 兼容」，处理扩展来源引起的 403，无需修改 `OLLAMA_ORIGINS` 或额外开启选项；旧配置升级后也默认开启，已手动关闭的设置会保留。

兼容处理仅作用于 WuPage 自身发往当前接口的请求，保留 API Key 等请求头，并在请求结束后移除临时规则。如果开启后仍返回 403，请检查服务端认证或反向代理配置；也可按 [Ollama 官方说明](https://docs.ollama.com/faq#how-can-i-allow-additional-web-origins-to-access-ollama) 配置 `OLLAMA_ORIGINS`。Windows 例如执行 `setx OLLAMA_ORIGINS "chrome-extension://扩展ID"` 后完全退出并重启 Ollama。

### HTTP 模板

模板中可以使用以下占位符：

| 占位符 | 内容 |
| --- | --- |
| `{{targetLang}}` | 目标语言代码 |
| `{{sourceLang}}` | 源语言代码，自动检测时为 `auto` |
| `{{texts}}` | 输入文本的直接表示 |
| `{{json texts}}` | JSON 编码后的输入文本数组 |

「响应路径」必须指向一个字符串数组，数组顺序和数量需要与输入文本一致。

## PDF 翻译

WuPage 会将原始 PDF 与翻译结果渲染在同步、按页对齐的两栏中。从当前在线或本地 PDF 标签页点击扩展弹窗的「翻译PDF」，即可直接打开并翻译。进入工作区后，也可以选择、拖放其他本地文件或粘贴 PDF 地址。

直接读取浏览器中已打开的本地 PDF（`file:///…`）需要在扩展详情中开启「允许访问文件网址」或「允许访问文件 URL」。未开启时，工作区提供设置入口；授权后可点击「重试打开」继续翻译。切换权限时浏览器可能重载扩展并关闭工作区，此时回到原 PDF 标签页再次点击「翻译PDF」即可。不想开启该权限时，可直接选择或拖放这份 PDF 文件，无需收藏扩展内部地址。

译文文本块支持就地编辑、移动、缩放和删除。WuPage 会尽可能从 PDF 文本层重建文字颜色与位置，完成校对后可下载当前版本的译文 PDF。

数学公式根据原 PDF 的数学字体、符号与位置识别后保留：独立公式和编号保持原位；行内公式随译文排版，保留上下标、分式及符号形状，不再交给翻译服务改写。显示和导出均使用原公式图像。若翻译服务改写、遗漏或重复公式标记，会自动规范化并重试受影响段落；仍不能保留时，仅翻译正文片段，再由扩展拼回原公式。只有公式校验通过的结果才会缓存，旧的不兼容缓存会自动避开。该识别依赖 PDF 文本层，并非所有文档都能准确识别。

当前限制：

- PDF 工作区尚未接入 OCR，因此无法翻译纯图片或扫描版 PDF；网页图片的 OCR 独立提供。
- 复杂表格、特殊字体和高度图形化的版面可能需要手动校正。
- 为保证多语言字体与版式一致，导出的页面目前会被扁平化，文字不可选择或搜索。

## 隐私与安全

WuPage 没有开发者运营的翻译代理或分析服务。翻译请求会从扩展直接发送到你选择的服务商；API 凭据、扩展设置和可选翻译缓存保存在浏览器本地。

这也意味着待翻译的网页或 PDF 文本会交给所选服务商处理。请不要通过不受信任的服务翻译敏感内容，并在使用前阅读对应服务商的条款。完整说明请参阅 [隐私政策](PRIVACY.md)。

## 开发

```bash
npm run dev        # 监听源码并持续构建
npm run typecheck  # TypeScript 类型检查
npm test           # 运行 Vitest 测试
npm run build      # 生成生产构建到 dist/
```

项目主要目录：

```text
src/
├── background/  # 服务商适配、任务调度、缓存与消息处理
├── content/     # 网页文本识别、译文渲染、段落模式与悬浮球
├── options/     # 设置与服务商配置界面
├── pdf/         # PDF 加载、布局、编辑、渲染与导出
├── popup/       # 扩展弹窗交互
└── shared/      # 类型、默认设置、语言与跨上下文工具
tests/           # Vitest 测试
public/          # Manifest 与扩展图标
```

提交改动前建议依次运行：

```bash
npm run typecheck
npm test
npm run build
```

复杂 PDF 的浏览器回归样本、执行方式和覆盖边界见 [PDF 排版回归](docs/pdf-regression.md)。

## 发布流程

推送 `v*` 标签会触发 GitHub Actions：校验 `package.json`、`package-lock.json` 与扩展 Manifest 的版本，执行类型检查和测试，构建扩展，并发布 ZIP 与 SHA-256 校验文件。

<details>
<summary>维护者发布说明</summary>

稳定版的三个版本号必须保持一致。以 `v1.1.0` 为例：

```bash
npm version 1.1.0 --no-git-tag-version
# 同步更新 public/manifest.json 后提交版本变更
git tag v1.1.0
git push origin main v1.1.0
```

预发布版本需要在 Manifest 中使用 Chromium 接受的纯数字版本，并通过 `version_name` 暴露 SemVer 标签：

```json
{
  "version": "1.1.0.1",
  "version_name": "1.1.0-beta.1"
}
```

带预发布后缀的标签会自动创建 GitHub Prerelease。成功发布后，工作流还会触发项目网站的版本同步。

### 自动同步到 Microsoft Edge Add-ons

项目支持通过 [微软官方的 Edge Add-ons Publish API](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api) 自动上传 Release ZIP 并提交审核。扩展需要已在商店完成首次发布。

首次配置：

1. 登录 [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview)，在 **Microsoft Edge → Publish API** 中启用使用 API Key 的新体验，并创建凭据，获取 **Client ID** 与 **API Key**。
2. 打开扩展概览，在 **Extension identity** 中复制 **Product ID**。这是 Partner Center 中的 GUID，不是商店详情页中由字母组成的扩展 ID。
3. 打开 GitHub 仓库 **Settings → Secrets and variables → Actions**，添加以下配置：

| 类型 | 名称 | 内容 |
| --- | --- | --- |
| Variable | `EDGE_PRODUCT_ID` | 扩展的 Product ID；配置后启用正式版自动提交 |
| Secret | `EDGE_CLIENT_ID` | Publish API 提供的 Client ID |
| Secret | `EDGE_API_KEY` | Publish API 提供的 API Key |

以后照常推送正式版 `v*` 标签：工作流创建 GitHub Release 后，直接调用商店发布工作流，下载该 Release 的原始 ZIP 与 SHA-256 校验文件，验证校验和及 Manifest 版本，上传 ZIP，等待上传成功，再提交微软审核并检查提交结果。使用的是 v1.1 的 API Key 认证（`Authorization: ApiKey ...`、`X-ClientID`），无需配置旧版 Access Token URL 或 Client Secret。

- 未配置 `EDGE_PRODUCT_ID` 时自动跳过商店提交；配置后缺少凭据会明确报错。预发布版本不提交商店。
- 商店发布与网站同步分别执行；GitHub Release 已创建时，网站同步失败不会阻止商店提交。
- 自动化成功表示已提交审核，上线仍需等待微软审核及商店分发。已有版本正在审核时，微软可能拒绝新的提交；处理完成后再重试。
- 如果仅商店提交失败，可在 GitHub **Actions → Publish to Microsoft Edge Add-ons → Run workflow** 中输入已有正式版标签，单独重试，无需重建 Release。若之前提交超时，请先在 Partner Center 确认是否已经受理。
- API Key 有有效期，请按 Partner Center 显示的到期时间更新 `EDGE_API_KEY`；Client ID 如有变化也需同步更新。商店简介、截图等元数据仍需在 Partner Center 维护。

</details>

## 参与项目

欢迎通过 [Issues](https://github.com/mr-wuliu/wupage/issues) 报告问题或提出建议，也欢迎提交 Pull Request。反馈翻译兼容性问题时，请尽量附上：

- 浏览器与 WuPage 版本；
- 使用的翻译服务类型；
- 可公开访问的复现页面或最小示例；
- Debug 面板中的错误信息（请先移除密钥和敏感文本）。

---

<div align="center">
  <sub>WuPage 只负责把内容发送给你选择的翻译服务；请始终谨慎处理敏感信息。</sub>
</div>
