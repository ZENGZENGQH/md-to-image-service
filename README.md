# MD 转图片服务

本地运行的 Markdown 转 PNG 图片 Web 工具。基于 Node.js + Express + Puppeteer。

## 功能

- 上传 `.md` 文件、拖拽文件或直接粘贴 Markdown 文本
- 支持标准 Markdown 语法（标题、列表、代码块、表格、引用等）
- 自动生成完整长图 PNG，保存至 output 目录
- 自动检测系统 Chrome / Edge 浏览器路径
- 启动时自动打开浏览器
- 自动检测新版本，旧版本强制更新

## 安装与使用

### 方式一：下载 Release（推荐）

1. 前往 [Releases](https://github.com/ZENGZENGQH/md-to-image-service/releases/latest) 下载最新版 zip 包
2. 解压，保持目录结构如下：

```
md-to-image-service/
├── md-to-image-service-vX.Y.Z-win-x64.exe
└── public/
    ├── index.html
    └── marked.min.js
```

3. 双击运行 exe，浏览器自动打开

### 方式二：源码运行

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

浏览器自动打开 http://localhost:3000。

## 环境要求

- **Windows** 系统，已安装 Google Chrome 或 Microsoft Edge（自动检测）
- **Node.js** >= 16（源码运行时需要）

## 构建独立 exe

```bash
npm install
npm run build
```

构建产物在 `dist/` 目录。

## API

### `POST /convert` — 转换 Markdown 为图片

| 参数 | 类型 | 说明 |
|------|------|------|
| `file` | File | 上传的 .md 文件（可选） |
| `text` | String | Markdown 文本（可选，与 file 二选一） |
| `name` | String | 文件名称（未上传文件时必填） |
| `theme` | String | 主题：`light`（默认）或 `dark` |
| `width` | String | 图片宽度，单位 px，默认 800 |

成功响应：
```json
{ "success": true, "filename": "20260513_文档名.png", "displayName": "20260513_文档名.png" }
```

### `GET /download/:filename` — 下载生成的图片

### `GET /api/version` — 版本检测

```json
{
  "current": "1.1.1",
  "latest": "1.1.2",
  "hasUpdate": true,
  "url": "https://github.com/ZENGZENGQH/md-to-image-service/releases/tag/v1.1.2"
}
```

> 当 `hasUpdate` 为 `true` 时，服务端拦截业务接口（返回 HTTP 426），前端显示强制更新提示。

## 发布流程

推送 `v*` 标签自动触发 GitHub Actions：

```bash
git tag v1.1.2
git push origin v1.1.2
```

## 项目结构

```
md-to-image-service/
├── server.js              # 后端服务
├── package.json           # 依赖配置
├── sea-config.json        # Node.js SEA 配置
├── public/
│   ├── index.html         # 前端页面
│   └── marked.min.js      # Markdown 解析库
├── scripts/
│   └── build-exe.js       # exe 构建脚本
├── .github/
│   └── workflows/
│       └── release.yml    # GitHub Actions 发布流程
├── output/                # 生成图片目录（自动创建）
└── dist/                  # 构建产物目录
```

## License

[MIT](LICENSE)
