# Muselab 云端个人工作台

代码放在 GitHub 私有仓库，Render 运行完整 Node 后台。不要使用 GitHub Pages，Pages 无法运行本项目的服务接口。

## 首次发布

1. 将项目提交到自己的 GitHub 私有仓库。`.env*`、本机 `data/`、上传图片、笔记和 Codex 原始聊天不提交。
2. 在 Render 创建 Blueprint，选择该仓库的 `render.yaml`。该配置使用付费 Starter 实例和 1 GB 持久磁盘，费用以 Render 确认页为准。
3. 设置 `MUSELAB_PASSWORD`（至少 12 位）。`MUSELAB_SESSION_SECRET` 和 `MUSELAB_SYNC_TOKEN` 由 Render 生成。需要图片识别时设置 `OPENAI_API_KEY`；无需生成时留空。
4. 部署成功后打开 Render 提供的 HTTPS 地址，使用访问密码登录。`/healthz` 只返回健康状态；页面、素材、上传图片和 API 全部要求登录。
5. 自定义域名时设置 `MUSELAB_PUBLIC_URL=https://你的域名`；默认自动使用 Render 分配的域名。

服务器使用 `npm ci --include=dev && npm run build:cloud` 构建，`npm start` 运行；不对公网开放 Vite 开发服务器。升级代码不会删除持久磁盘内的数据。请在 Render 对持久磁盘设置备份；丢失磁盘会丢失云端私有数据。图片生成需要在 Render 的 Environment 中另外添加 `OPENAI_API_KEY`，不要填入前端代码。

## 本机工作记录与素材同步

云服务器不能读取你电脑上的 Codex 聊天，也不会远程控制电脑。先在本机刷新工作记录和采集素材，再运行同步。

在项目根目录自行新建 `.env.cloud.local`（已被 Git 忽略），填入：

```dotenv
MUSELAB_CLOUD_URL=https://你的服务.onrender.com
MUSELAB_SYNC_TOKEN=从Render环境变量页面复制
```

执行 `npm run sync:cloud`。它仅发送已汇总的当天简报和已保存的 Pinterest 素材，不发送原始聊天、浏览器凭据或模型密钥；Pin ID 去重，保留云端已有素材编辑。同步接口始终要求专用 Bearer Token。不要将这个文件提交 GitHub。需每天自动同步时，可在现有本机采集和简报任务成功后运行该命令。

网页内刷新会读取云端最近收到的简报，不会声称读取了本机新聊天。资讯在服务器运行期间于上海时间 07:45 后自动更新；源站失败保留上一期，并重试。Pinterest 登录采集仍在本机进行。

## 笔记与个人编辑

云端登录后，笔记、文件夹、素材编辑、每日待办会保存到持久磁盘；同一密码登录的设备共享这些内容。启动页面时先读取云端副本，编辑后自动同步。多设备同时修改同一类内容时会提示冲突，保留本机副本，不覆盖服务器；先导出笔记备份再重新打开。旧的本机网站与新域名的浏览器存储互相独立，旧笔记不会因发布自动搬到云端。

这是单人工作台的访问密码登录，不是多人账号系统；只有你信任的设备和人员应持有密码。退出使用页面右下角“退出登录”。退出后服务器 API 和媒体立即需要重新登录；浏览器本机副本仍保留，请在自己的设备使用。

## 本地验证云端版本

运行 `npm run build:cloud`，设置 `MUSELAB_PASSWORD`、`MUSELAB_SESSION_SECRET`、`MUSELAB_SYNC_TOKEN`、`MUSELAB_PUBLIC_URL=http://127.0.0.1:10000` 和 `HOST=127.0.0.1`，再运行 `npm start`。本机预览可使用 HTTP；正式部署使用 HTTPS。
