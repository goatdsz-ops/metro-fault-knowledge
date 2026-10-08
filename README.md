# 城域网故障知识库 · GitHub版

成员使用 GitHub Issue 表单登记故障或补充案例，维护人员审核后，GitHub Actions 保存审核快照并更新 GitHub Pages。网页支持关键词组合搜索、分类/设备/机房筛选、案例详情、关联经验、已审核补充和结果导出。

这是独立的 GitHub 项目，不依赖 ChatGPT 登录、Sites 或外部数据库。Node.js 22 用于构建；无 npm 第三方依赖。浏览器端无外部字体、脚本或统计服务。

## 先看效果

交付压缩包根目录的 `preview.html` 可直接用浏览器打开，无需安装。它包含原表678条台账记录和33篇经验，仅用于本地预览。数据来自原始历史文件，不包含此后可能在旧站点新增的内容。

预览中的表单可以整理、下载登记文本。连接实际仓库后，“前往GitHub表单”才可正式提交。网站不在浏览器保存知识库内容，只可保存仓库入口偏好。

## 交付包目录

- `repository/`：可以导入 GitHub 的完整项目，默认仅发布6条明确标注的虚构演示记录。
- `local-only/history.json`：原始711条历史数据，仅供本地迁移和复核。
- `preview.html`：含真实历史数据的本地预览页面。
- `START_HERE.md`：快速开始说明。

**只将 `repository/` 内的内容上传到目标仓库。不要把 `local-only/` 或 `preview.html` 上传至公开仓库。** `.gitignore` 只对Git操作生效，不能阻止通过网页手动上传文件。

## 首次部署

1. 新建专用 GitHub 仓库，以 `main` 为默认分支。内部资料需先确定仓库及网站可见性。私有仓库不自动意味着Pages网站私有，私有发布需满足GitHub账户/组织计划要求。
2. 将 `repository/` 内的全部文件上传到仓库根目录，包括 `.github` 文件夹。不要额外嵌套一层 `repository`。
3. Settings → Pages → Build and deployment → Source，选择 **GitHub Actions**。若计划不支持当前仓库的Pages发布，需调整合适的托管/计划，不能用网页伪登录保护公开数据。
4. Actions → **初始化审核标签** → Run workflow。它会创建 `kb-pending`、`kb-approved`、`kb-withdrawn`。
5. Actions → **审核并发布知识库** → Run workflow。成功后，部署记录给出网站地址。
6. 添加团队成员。成员至少需要目标仓库的Issue访问权限；审核人员需要仓库 write、maintain 或 admin 权限。
7. 用一条无敏感内容的测试案例验证：提交表单、添加审核标签、等待发布、在网页检索。确认后再选择要迁移的历史记录。

工作流使用内置 `GITHUB_TOKEN`，无需把个人访问令牌放进网页或配置文件。Actions需要允许工作流声明的内容写入及Issue写入权限。若组织规则禁止机器人直接推送 `main`，审核快照提交会失败；需要由管理员按组织规则配置允许的自动化身份，或改造为PR审核流程。不要为了本项目全局关闭分支保护。

## 提交与审核

### 新案例与复盘经验

点击网站“提交案例”，填写整理表单。前往GitHub后，核对记录类型、故障类别和正文并正式提交。也可以直接在GitHub Issues → New issue选择表单。

网站通过URL预填自定义文本字段。下拉字段需在GitHub上再次核对。内容过长时不放入URL，先下载登记文本，再复制进GitHub表单。

新Issue默认带 `kb-pending`。具有写入/管理权限的维护人员复核后，添加 **`kb-approved`** 标签。系统检查审核人权限、表单必填项、关联编号及内容是否在审核期间发生变化。

审核通过后，`data/approved/issue-N.json` 保存当前内容快照、提交人、审核人、时间及内容哈希，随后在同一工作流中发布网站。网站展示这一审核快照；GitHub普通讨论评论不会自动发布。

### 补充已有案例

在案例详情点击“补充这条案例”，使用补充表单填写内容。系统使用唯一编号（如 `CASE-0001`、`EXP-004`、`GH-12`）关联，不能使用可能重复的旧业务编号代替。补充Issue同样由维护人员添加 `kb-approved` 后发布。

目标案例必须已存在于网站发布数据中。本地预览中的历史案例若尚未迁入 `data/history.json`，不能作为线上补充目标。

### 修改与撤回

- Issue正文或标题编辑后，自动移除通过标签并标为待审核。网站保留上次通过的版本；新内容需重新审核，不能继承旧审核。
- 复核后重新添加 `kb-approved`，以新快照替换旧快照，Git提交历史保留旧版本。
- 撤回时添加 **`kb-withdrawn`**。该案例及其已发布补充会从网站移除，Git和Issue历史仍保留。撤回不是敏感信息彻底删除功能。
- 仅关闭Issue、删除普通评论或移除 `kb-approved` 标签不代表撤回网站内容。
- 已发布记录不能改变类型；需要改变时新建Issue。
- GitHub工作流失败时，网站可能仍是旧版本。以Actions成功结果为准；标签本身不是部署成功证明。

## 历史数据迁移

原表存在重复业务编号、示例标记、汇总记录和关联歧义。本地预览保留所有记录，以系统唯一编号区分，原编号和来源行可追溯。

正式迁移前审查需要发布的记录及个人信息、内部设备/地址等字段。将允许在目标仓库和网站保存的数组写入 `data/history.json`，提交至 `main` 后自动更新网站。这里的数据会进入仓库和网页文件，前端隐藏不能提供保密性。

`local-only/history.json` 是迁移来源，**不会被默认构建读取**。不要直接将全部历史内容复制到公开仓库。若已有旧站点新增数据，应先导出最新JSON，再进行字段转换和去重；本包没有读取旧站点的实时数据库。

原表只提到文件名的复盘报告没有附件原件。本版本不会上传或索引这些附件。

## 本地运行与维护

在 `repository/` 目录中执行：

```bash
npm test
npm run build
```

构建产物为 `dist/index.html`，可直接用浏览器打开。全部资源内嵌，支持GitHub Pages项目路径，不需要额外服务器。部署时自动读取 `GITHUB_REPOSITORY` 生成提交入口，本地可在 `site.config.json` 中设置 `repository` 为 `用户名/仓库名`。

若要重建包含内部历史数据的本地预览，先将压缩包中的历史JSON复制到本项目的 `private-data/history.json`，然后执行 `npm run preview`。该目录与产物 `preview/` 均被Git忽略。

构建只包含 `data/history.json` 和审核快照；没有正式数据时才显示虚构演示集。审核任务可并行处理不同Issue，提交冲突时会尝试rebase，冲突无法解决会停止。部署任务串行执行，进入部署阶段后重新读取最新仓库快照，避免旧产物覆盖已提交的新内容。

## 已验证与待上线验证

已提供自动化测试，覆盖表单解析、审核权限、过期审核拒绝、修改保留旧版本、关联完整性、撤回及补充删除。测试中的GitHub接口为模拟响应，不会创建真实Issue。

交付时未指定目标仓库，因此尚未执行真实GitHub提交、Actions运行或Pages发布。上线后需完成一次真实的提交—审核—检索验收。

## 官方参考

- GitHub Pages：https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Issue Forms：https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms
- Pages工作流：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- 页面访问范围：https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site
