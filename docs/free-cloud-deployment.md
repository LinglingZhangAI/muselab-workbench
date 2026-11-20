# Muselab：Render Free + Supabase Free

项目：<https://supabase.com/dashboard/project/bhsvbwlgslzmwbplcksx>

## 当前状态

Supabase 已建表，371 张图片已上传并逐张回读校验，12 份资料已迁移；临时生产服务的登录、数据库读取、私有图片和已有字幕检查通过。浏览器内的笔记与白板仍需按下面的迁移页面导入。

Render 仓库连接已通过，但创建 Free 服务时返回 HTTP 402：当前账号需要先在 Billing 添加银行卡验证。尚未创建服务，也未上线。完成账号验证后可继续运行部署脚本；脚本固定 `plan: free`，不会创建磁盘或 Render 数据库。

## 1. 初始化 Supabase

1. 确认项目使用 Free 计划。
2. 打开项目 SQL Editor：<https://supabase.com/dashboard/project/bhsvbwlgslzmwbplcksx/sql/new>。
3. 粘贴并运行 `deploy/supabase.sql`。它创建两张数据表、带版本冲突检查的保存函数和私有 `muselab-media` 图片桶；可以重复运行，不清空已有数据。若已有同名桶，需确认它的 Public 开关为关闭。
4. 在项目 Settings → API Keys 找到服务端 Secret key（`sb_secret_…`）或旧版 `service_role`。把它填入本机 `.env.cloud.local` 的 `SUPABASE_SERVICE_ROLE_KEY`。不要使用 Publishable / anon key，不要把服务端密钥发到聊天或放进 `VITE_` 变量。
5. 执行 `npm run cloud:check`，确认数据表及私有桶可访问。

## 2. 迁移本机文件

先运行 `npm run cloud:migrate` 预览，再运行 `npm run cloud:migrate -- --apply`。

脚本先上传并逐张回读校验图片，再写入资料。已有云端资料保持原值；中断后可以重跑。包含灵感图、文章配图、上传图片、每日新闻、首页文章、播客、完成的字幕和每日简报；不上传本机 Python、语音模型、原始音频、凭据或原始聊天。

笔记、文件夹、个人素材修改与白板可能只保存在原来 localhost 浏览器的 localStorage/IndexedDB，不能靠扫描项目文件迁移。在原浏览器打开 <http://127.0.0.1:4187/cloud-transfer.html> 下载资料备份；首次上线后，在新网站登录并访问 `/cloud-transfer.html`，选择备份导入。它保留已有云端项目，差异会跳过，首次为空时才写入，防止覆盖；导入完刷新工作台。图片先用上面的迁移脚本上传。白板支持原有导出 PNG 和 Excalidraw 文件；新云端白板会保存到数据库，并留本机副本。请勿清除旧浏览器数据。

## 3. 部署到 Render

当前使用 API 部署：`.env.cloud.local` 已配置 Render API Key 和网站访问凭据，不要提交该文件。账号验证完成后执行 `node scripts/render-deploy.mjs create tea-dbc8o14s728c73ecadcg codex/render-free-supabase`；脚本检查重复服务，使用完整 `.git` 克隆地址，并将服务 ID 与网站 URL 保存回本机配置。用 `node scripts/render-deploy.mjs status` 检查构建和启动结果。API 返回错误不代表上线完成。

也可改用 Blueprint 网页方式：

构建并检查后，将审核过的项目版本推送到 GitHub，再在 Render 选择 New → Blueprint，连接 `LinglingZhangAI/muselab` 仓库并选择该版本所在分支。

仓库 `render.yaml` 已配置 Free Web Service，不创建 Render 数据库，不挂载付费磁盘，自动部署关闭。若旧服务已经挂载磁盘，先完成数据迁移并确认新免费服务可用；不要直接删除旧磁盘。

Render 提示时填入：

| 环境变量 | 值 |
| --- | --- |
| `SUPABASE_URL` | `https://bhsvbwlgslzmwbplcksx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥 |
| `MUSELAB_PASSWORD` | 你设置的网站访问密码，至少 12 位 |

其他变量由 Blueprint 配置。`MUSELAB_SESSION_SECRET`、`MUSELAB_SYNC_TOKEN` 为 Render 自动生成；`MUSELAB_DATA_DIR` 只是临时缓存，正式资料保存在 Supabase。网站通过 Render 提供的域名识别 HTTPS 地址。

## 4. 上线验收

1. `/healthz` 返回 `{"ok":true}`；未登录不能访问笔记 API 和私有图片。
2. 登录后检查灵感图片、文章、播客和已同步字幕。
3. 新建笔记、修改文件夹、编辑白板，确认显示已保存或已同步。
4. 手动重启 Render，重新登录确认文字、白板和新上传图片仍存在。
5. 在另一浏览器修改同一笔记，验证旧页面保存会提示冲突而非静默覆盖。
6. 检查构建产物不包含任何真实 Supabase 服务端密钥。

## 5. 后续同步

在 `.env.cloud.local` 填入 Render 的根地址 `MUSELAB_CLOUD_URL` 与 `MUSELAB_SYNC_TOKEN`，执行 `npm run sync:cloud`。各资料分项执行，失败返回非零状态；字幕仅上传已完成的真实转写，已有图片跳过。图片失败时不更新引用它的文章/素材清单。

当前没有修改任何本机自动化。账号连接与部署验收后，可另行把这条同步命令接到采集任务完成之后。

## 免费方案的边界

- Render 免费服务会闲置休眠，唤醒可能较慢；睡眠期间不保证 07:45 定时任务运行。新闻可在访问时补取，本机任务仍按本机调度运行。
- 字幕生成、基于本机 Codex 的产品研究/文章生成、语雀 CLI 依赖本机，云端目前仅提示返回本机执行；已保存的笔记与白板仍可云端阅读编辑。
- Supabase Free 存储和流量有限，项目闲置会暂停；免费自动备份不包含在本方案内，保留本机原文件并定期导出。
- 白板目前整份保存，包含嵌入图片时上限 24MB；超限会显示保存失败，本机副本保留。图片灵感库与文章配图独立保存在 Storage。
