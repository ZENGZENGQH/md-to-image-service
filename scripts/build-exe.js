const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const distDir = path.join(__dirname, "..", "dist");
const exePath = path.join(distDir, "md-to-image-service.exe");
const blobPath = path.join(distDir, "sea-prep.blob");

// 复制 node.exe
const nodeExe = process.execPath;
console.log(`复制 Node.js: ${nodeExe}`);
fs.copyFileSync(nodeExe, exePath);

// 注入 SEA blob
console.log("注入 SEA blob...");
execSync(
  `npx postject "${exePath}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
  { stdio: "inherit" }
);

// 复制 public 目录到 dist（exe 运行时需要）
const publicSrc = path.join(__dirname, "..", "public");
const publicDest = path.join(distDir, "public");
if (!fs.existsSync(publicDest)) {
  fs.cpSync(publicSrc, publicDest, { recursive: true });
  console.log("已复制 public/ 目录");
}

const stats = fs.statSync(exePath);
const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
console.log(`\n构建完成: dist/md-to-image-service.exe (${sizeMB} MB)`);
