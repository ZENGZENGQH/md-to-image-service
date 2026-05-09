# MD 转图片服务

本地离线运行的 Markdown 转 PNG 图片 Web 工具。基于 Node.js + Express + Puppeteer，纯本地处理，无任何联网请求。

## 功能

- 上传 `.md` 文件或直接粘贴 Markdown 文本
- 支持标准 Markdown 语法（标题、列表、代码块、表格、引用等）
- 浅色 / 深色双主题切换
- 自定义图片宽度（400-2000px）
- 自动生成完整长图 PNG

## 环境要求

- **Node.js** >= 16
- **Windows** 系统，已安装 Google Chrome 或 Microsoft Edge

> macOS / Linux 用户需手动修改 `server.js` 中的浏览器路径。

## 快速开始

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

浏览器打开 http://localhost:3000 即可使用。

## API

```
POST /convert
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `file` | File | 上传的 .md 文件（可选） |
| `text` | String | Markdown 文本（可选，与 file 二选一） |
| `name` | String | 文件名称（未上传文件时必填） |
| `theme` | String | 主题：`light`（默认）或 `dark` |
| `width` | String | 图片宽度，单位 px，默认 800 |

成功响应：
```json
{ "success": true, "filename": "2026-05-09-21-47-27_文档名.png" }
```

## 项目结构

```
md-to-image-service/
├── server.js          # 后端服务
├── package.json       # 依赖配置
├── public/
│   ├── index.html     # 前端页面
│   └── marked.min.js  # Markdown 解析库
├── uploads/           # 临时上传目录（自动创建，自动清理）
└── output/            # 生成图片目录（自动创建）
```

## License

[MIT](LICENSE)
