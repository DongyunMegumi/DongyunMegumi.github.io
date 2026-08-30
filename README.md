# Dongyun Megumi 个人博客（Hexo + GitHub Pages）

- **线上地址**：<https://dongyunmegumi.github.io/>
- **仓库**：<https://github.com/DongyunMegumi/DongyunMegumi.github.io>
- **主题**：Butterfly 5.7 + 深空紫定制（与 character-showcase-v2 视觉一致）

## 分支结构

| 分支 | 内容 | 说明 |
| --- | --- | --- |
| `main` | 编译后的静态页面 | GitHub Pages 从这里服务，**不要手动改** |
| `source` | Hexo 源码 | 写文章、改配置在这里操作 |

## 日常写文章

1. 在 `source/_posts/` 下新建 `.md` 文件（或用 `npx hexo new "标题"`）
2. 本地预览：`npx hexo server` → 打开 <http://localhost:4000>
3. 发布：`npx hexo clean && npx hexo generate && npx hexo deploy`
4. 备份源码：`git add -A && git commit -m "new post" && git push origin source`

等 1~2 分钟 GitHub Pages 重新构建完成，线上就更新了。

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
