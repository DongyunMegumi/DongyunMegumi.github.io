# Dongyun Megumi 个人博客（Hexo + GitHub Pages）

- **线上地址**：<https://dongyunmegumi.github.io/>
- **仓库**：<https://github.com/DongyunMegumi/DongyunMegumi.github.io>
- **页面**：新版作品集首页与子页面；博客文章保留 Butterfly 5.7

## 分支结构

| 分支 | 内容 | 说明 |
| --- | --- | --- |
| `main` | 编译后的静态页面 | GitHub Pages 从这里服务，**不要手动改** |
| `source` | Hexo 源码 | 写文章、改配置在这里操作 |

## 日常写文章

1. 在 `source/_posts/` 下新建 `.md` 文件（或用 `npx hexo new "标题"`）
2. 本地预览：`npx hexo server` → 打开 <http://localhost:4000>
3. 完整构建：`npm run clean && npm run build`（首次需安装根目录及 `preview/portfolio-case/` 的依赖）
4. 提交并推送到 `source`，GitHub Actions 会自动构建博客和新版作品集并更新 `main`

等 1~2 分钟 GitHub Pages 重新构建完成，线上就更新了。

## 作品集发布

页面源码在 `preview/portfolio-case/`，发布入口为 `tools/build-portfolio.cjs`。
首页、模型总览、Sumi 展示、委托、News、About 和 Archive 都会生成独立静态页面。
原有博客文章、归档和角色详情保留。

`portfolio-assets/` 只存经批准的公开展示素材，包括精简后的 Sumi GLB。
浏览器展示模型的文件可被访客获取；此目录不提供防下载保护。
原始 VRM、Blender 工程、`.local.json` 和 `.local-assets/` 不发布。

## 文章头格式

```markdown
---
title: 文章标题
date: 2026-08-30 17:00:00
tags:
  - Blender
categories:
  - 技術メモ
cover: /img/cover-default.jpg   # 可省略，会自动随机用默认封面
---

正文（Markdown）...
```

## 关键文件

- `_config.yml` — 站点信息、部署配置
- `_config.butterfly.yml` — 主题配置（配色 `theme_color`、菜单、社交链接、暗色模式 `display_mode: dark`）
- `source/css/custom.css` — 深空紫定制样式（背景渐变、卡片光晕、导航描边）
- `source/img/` — 头像和封面图
- `source/about/index.md` — 关于页（内容与 X 简介一致）

## 配色令牌（与 character-showcase-v2 一致）

```
背景     #06040f    卡片   #0d0a1f
主色     #8b75d7    亮主色 #a992f0    暗主色 #4a3878
正文     #f0ecff    次级   #a09abd
描边     rgba(139,117,215,0.18)
金色点缀 rgba(201,168,76,0.35)
标题字体 Noto Serif JP / 正文 Noto Sans JP
```
