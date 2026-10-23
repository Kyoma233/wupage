# 开发指南

[返回 README](../README.md)

## 开发

### 从源码构建

需要 Node.js 22 或更高版本，以及 npm。

```bash
git clone https://github.com/mr-wuliu/wupage.git
cd wupage
npm ci
npm run build
```

构建完成后，按照 [README 中的手动安装说明](../README.md) 加载 `dist/` 目录。

### 日常开发

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

### 图片翻译回归验证

- 本地视觉回归页：运行开发预览服务后打开 `tests/fixtures/image-preview.html`，使用固定模型结果检查覆盖、切换、缩放与内部滚动，不调用外部 API。
- OCR 实测页：先 `npm run build`，再 `node tests/fixtures/ocr-preview-server.mjs`，打开 `http://127.0.0.1:5175`，验证真实下载、安装、识别、状态持久化和删除。仅模拟扩展消息，OCR 模型、沙箱和校验使用生产实现。日文透明文字样例还支持真实翻译，以及使用固定译文的符号覆盖与断句回归。
