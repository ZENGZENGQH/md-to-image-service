const express = require("express");
const multer = require("multer");
const { marked } = require("marked");
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

// pkg 打包后 __dirname 指向虚拟快照（只读），可写目录需用 process.cwd()
const WORK_DIR = typeof process.pkg !== "undefined" ? process.cwd() : __dirname;

// 版本信息（优先从 WORK_DIR 读取 package.json，打包环境兜底硬编码）
const REPO = "ZENGZENGQH/md-to-image-service";
let CURRENT_VERSION = "1.0.6";
try {
	const pkgPath = path.join(WORK_DIR, "package.json");
	if (fs.existsSync(pkgPath)) {
		CURRENT_VERSION = JSON.parse(fs.readFileSync(pkgPath, "utf-8")).version;
	}
} catch {
	// 打包环境无 package.json 时使用硬编码版本
}

// 自动检测系统 Chromium 浏览器路径（Chrome / Edge）
function findBrowserPath() {
	const candidates = [
		process.env.LOCALAPPDATA &&
			`${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
		"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
		"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
		"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
		"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
	].filter(Boolean);
	for (const p of candidates) {
		if (fs.existsSync(p)) return p;
	}
	return null;
}
const BROWSER_PATH = findBrowserPath();

// 确保 uploads 和 output 目录存在
["uploads", "output"].forEach((dir) => {
	const dirPath = path.join(WORK_DIR, dir);
	if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// multer 配置：文件暂存至 uploads/，仅允许 md/txt 文件，限制 20MB
const upload = multer({
	dest: path.join(WORK_DIR, "uploads"),
	limits: { fileSize: 20 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (/\.(md|markdown|txt)$/i.test(file.originalname)) {
			cb(null, true);
		} else {
			cb(new Error("仅支持 .md / .markdown / .txt 文件"));
		}
	},
});

// 静态资源
app.use(express.static(path.join(WORK_DIR, "public")));
app.use(express.json({ limit: "10mb" }));

// 版本状态缓存
let latestVersion = CURRENT_VERSION;
let updateUrl = "";

// 查询最新版本（启动时 + 每 30 分钟刷新）
async function fetchLatestVersion() {
	try {
		const resp = await fetch(
			`https://api.github.com/repos/${REPO}/releases/latest`,
			{
				headers: { "User-Agent": `md-to-image-service/${CURRENT_VERSION}` },
				signal: AbortSignal.timeout(5000),
			},
		);
		if (!resp.ok) return;
		const data = await resp.json();
		latestVersion = (data.tag_name || "").replace(/^v/, "");
		updateUrl = data.html_url || `https://github.com/${REPO}/releases/latest`;
	} catch {
		// 网络不可达时保持当前值
	}
}

// 版本检测接口
app.get("/api/version", (_req, res) => {
	res.json({
		current: CURRENT_VERSION,
		latest: latestVersion,
		hasUpdate: latestVersion !== CURRENT_VERSION,
		url: updateUrl || `https://github.com/${REPO}/releases/latest`,
	});
});

// 版本过旧拦截中间件：旧版本禁止使用核心功能
app.use((req, res, next) => {
	// 仅拦截业务接口，放行版本检测和静态资源
	if (req.path === "/api/version" || !req.path.startsWith("/api/") && !req.path.startsWith("/convert") && !req.path.startsWith("/download")) {
		return next();
	}
	if (latestVersion && latestVersion !== CURRENT_VERSION) {
		return res.status(426).json({
			error: "版本过旧，请更新至最新版本",
			current: CURRENT_VERSION,
			latest: latestVersion,
			url: updateUrl,
		});
	}
	next();
});

// 提交转换请求
app.post("/convert", upload.single("file"), async (req, res) => {
	const { text, theme, width, name } = req.body;
	const file = req.file;
	let mdContent = "";
	let uploadedFilePath = null;
	let baseName = "";

	try {
		// 读取 Markdown 内容
		if (file) {
			uploadedFilePath = file.path;
			mdContent = fs.readFileSync(uploadedFilePath, "utf-8");
			baseName = path.basename(file.originalname, path.extname(file.originalname));
		} else if (text && text.trim()) {
			mdContent = text;
		} else {
			return res
				.status(400)
				.json({ error: "请上传 .md 文件或粘贴 Markdown 文本" });
		}

		// 确定文件名：优先用前端传来的 name，其次用上传文件名
		if (name && name.trim()) {
			baseName = name.trim();
		}
		if (!baseName) {
			return res.status(400).json({ error: "请填写文件名称" });
		}

		if (!mdContent.trim()) {
			return res.status(400).json({ error: "内容为空，请检查文件或文本" });
		}

		// 解析 Markdown 为 HTML
		const htmlBody = marked.parse(mdContent);

		// 图片宽度
		const imgWidth = parseInt(width) || 800;
		const clampedWidth = Math.max(400, Math.min(2000, imgWidth));

		// 主题样式
		const isDark = theme === "dark";
		const themeCSS = isDark
			? `body{background:#1A1A1A;color:#E5E7EB;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;padding:32px 40px;max-width:${clampedWidth}px;word-wrap:break-word}
h1,h2,h3,h4,h5,h6{color:#F3F4F6;border-bottom:1px solid #374151;padding-bottom:8px}
h1{font-size:2em}h2{font-size:1.5em}h3{font-size:1.25em}
a{color:#60A5FA;text-decoration:none}
code{background:#2D2D2D;padding:2px 6px;border-radius:4px;font-size:0.9em;color:#E5E7EB}
pre{background:#2D2D2D;padding:16px;border-radius:8px;overflow-x:auto}
pre code{background:none;padding:0}
blockquote{border-left:4px solid #60A5FA;background:#2A2A2A;margin:16px 0;padding:12px 20px;border-radius:0 8px 8px 0}
table{border-collapse:collapse;width:100%;margin:16px 0}
th,td{border:1px solid #374151;padding:10px 14px;text-align:left}
th{background:#2D2D2D;font-weight:600}
tr:nth-child(even){background:#222222}
hr{border:none;border-top:1px solid #374151;margin:24px 0}
img{max-width:100%;border-radius:8px}
ul,ol{padding-left:2em}
li{margin:4px 0}`
			: `body{background:#FFFFFF;color:#24292E;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;padding:32px 40px;max-width:${clampedWidth}px;word-wrap:break-word}
h1,h2,h3,h4,h5,h6{color:#1F2328;border-bottom:1px solid #D1D9E0B3;padding-bottom:8px}
h1{font-size:2em}h2{font-size:1.5em}h3{font-size:1.25em}
a{color:#0969DA;text-decoration:none}
code{background:#F6F8FA;padding:2px 6px;border-radius:4px;font-size:0.9em}
pre{background:#F6F8FA;padding:16px;border-radius:8px;overflow-x:auto}
pre code{background:none;padding:0}
blockquote{border-left:4px solid #0969DA;background:#DDF4FF40;margin:16px 0;padding:12px 20px;border-radius:0 8px 8px 0}
table{border-collapse:collapse;width:100%;margin:16px 0}
th,td{border:1px solid #D1D9E0;padding:10px 14px;text-align:left}
th{background:#F6F8FA;font-weight:600}
tr:nth-child(even){background:#F6F8FA80}
hr{border:none;border-top:1px solid #D1D9E0;margin:24px 0}
img{max-width:100%;border-radius:8px}
ul,ol{padding-left:2em}
li{margin:4px 0}`;

		// 完整 HTML
		const fullHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${themeCSS}</style></head><body>${htmlBody}</body></html>`;

		// 启动 Puppeteer 渲染
		const browser = await puppeteer.launch({
			headless: "new",
			executablePath: BROWSER_PATH || undefined,
			// Windows 本地环境需要禁用沙箱，否则 Puppeteer 启动报错
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});
		const page = await browser.newPage();
		await page.setViewport({ width: clampedWidth, height: 800 });
		await page.setContent(fullHTML, { waitUntil: "networkidle0" });

		// 获取实际内容高度
		const bodyHeight = await page.evaluate(() => document.body.scrollHeight);

		// 截图为 PNG
		const screenshot = await page.screenshot({
			type: "png",
			clip: { x: 0, y: 0, width: clampedWidth, height: bodyHeight },
			omitBackground: false,
		});
		await browser.close();

		// 保存到 output 文件夹
		const saveDir = path.join(WORK_DIR, "output");

		// 文件名：时间戳（纯 ASCII，避免 Windows 编码问题）
		const now = new Date();
		const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
		const filename = `${timestamp}.png`;
		const savePath = path.join(saveDir, filename);
		fs.writeFileSync(savePath, screenshot);

		// 返回保存结果（displayName 用于前端展示，filename 用于下载）
		res.json({ success: true, filename, displayName: baseName });
	} catch (err) {
		console.error("转换失败:", err);
		res.status(500).json({ error: "转换失败，请检查输入内容或稍后重试" });
	} finally {
		// 清理上传的临时文件
		if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
			fs.unlinkSync(uploadedFilePath);
		}
	}
});

// 下载生成的图片
app.get("/download/:filename", (req, res) => {
	const filename = path.basename(req.params.filename);
	const filePath = path.join(WORK_DIR, "output", filename);
	const outputDir = path.resolve(WORK_DIR, "output");
	if (!filePath.startsWith(outputDir + path.sep) && filePath !== outputDir) {
		return res.status(400).json({ error: "无效的文件名" });
	}
	if (!fs.existsSync(filePath)) {
		return res.status(404).json({ error: "文件不存在" });
	}
	res.download(filePath);
});

// 启动时检查最新版本
async function checkUpdate() {
	await fetchLatestVersion();
	if (latestVersion && latestVersion !== CURRENT_VERSION) {
		console.log(`\n  ⚠ 发现新版本: v${latestVersion} (当前: v${CURRENT_VERSION})`);
		console.log(`  下载: ${updateUrl || `https://github.com/${REPO}/releases/latest`}`);
	}
}

// 每 30 分钟刷新一次最新版本
setInterval(fetchLatestVersion, 30 * 60 * 1000).unref();

app.listen(PORT, "127.0.0.1", () => {
	console.log(`\n  MD 转图片服务已启动: http://localhost:${PORT}`);
	console.log(`  当前版本: v${CURRENT_VERSION}`);
	if (BROWSER_PATH) {
		console.log(`  浏览器: ${BROWSER_PATH}`);
	} else {
		console.warn("  警告: 未检测到 Chrome/Edge，将尝试使用默认浏览器路径");
	}
	console.log();
	checkUpdate();
});
