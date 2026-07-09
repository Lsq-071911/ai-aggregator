---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a6921600963422a5714cd5a422a62ac7_1895ac7a7b4b11f193f6525400826444
    ReservedCode1: AhWk0T39QEB/8TMEK4jjFBQBV8OUs2xNS5evFw+Kzx37/BE2nT21fQDthhhxd5R/wCwKPEZ8RFXpAPGSec6PMyjnYbFLI4WAEhOECoDohwlL14lANy9lq95Guu18hvX4+i6YyKAf74wgnjFXuNORlKS+NX9B205KKc4wWvZO0G2KYO2oPjTL6efdRPY=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a6921600963422a5714cd5a422a62ac7_1895ac7a7b4b11f193f6525400826444
    ReservedCode2: AhWk0T39QEB/8TMEK4jjFBQBV8OUs2xNS5evFw+Kzx37/BE2nT21fQDthhhxd5R/wCwKPEZ8RFXpAPGSec6PMyjnYbFLI4WAEhOECoDohwlL14lANy9lq95Guu18hvX4+i6YyKAf74wgnjFXuNORlKS+NX9B205KKc4wWvZO0G2KYO2oPjTL6efdRPY=
---

# AI聚合 · 智能大模型中转站

商业级 AI 聚合大模型 SAAS 网站，聚合 OpenAI / Anthropic / Google / DeepSeek / Meta / 阿里云 / 智谱 / Mistral 等 50+ 大模型，提供统一的聊天对话界面。

## 功能特性

- **用户系统** — 基于 Supabase Auth 的注册/登录/注销/密码重置
- **会员 VIP** — 免费/月卡/年卡三级会员，会员码激活
- **AI 聚合** — 通过 OpenRouter 聚合 50+ 大模型，统一 API 调用
- **流式聊天** — SSE 流式输出，支持 Markdown 渲染、代码高亮
- **对话管理** — 多对话切换、历史记录、上下文管理
- **管理后台** — 用户管理、会员码生成、统计面板
- **商业级 UI** — 暗色主题、紫蓝渐变、流畅动画、响应式布局

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                      用户浏览器                          │
│                   (SPA 单页应用)                          │
│              HTML + CSS + Vanilla JS                     │
└────────────┬────────────────────────────┬───────────────┘
             │                            │
     ┌───────▼────────┐          ┌───────▼────────┐
     │  GitHub Pages  │          │    Supabase     │
     │  静态文件托管   │          │  (BaaS 后端)    │
     └────────────────┘          │                 │
                                 │  Auth 认证      │
                                 │  PostgreSQL DB  │
                                 │  Edge Functions │
                                 └───────┬─────────┘
                                         │
                                ┌────────▼────────┐
                                │   OpenRouter     │
                                │  (AI 模型聚合)   │
                                │  50+ 大模型      │
                                └─────────────────┘
```

## 快速开始

### 1. 注册 Supabase

前往 [supabase.com](https://supabase.com) 注册账号并创建项目。

### 2. 配置数据库

在 Supabase SQL Editor 中依次执行：

```
supabase/schema.sql   — 创建表结构
supabase/seed.sql     — 插入初始数据
```

### 3. 配置环境变量

在 Supabase Dashboard → Settings → API 获取：
- `SUPABASE_URL` — 项目 URL
- `SUPABASE_ANON_KEY` — 匿名公钥

将 `js/supabase.js` 中的占位值替换为你的实际值。

### 4. 配置 Edge Functions

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 部署函数
supabase functions deploy ai-proxy
supabase functions deploy generate-codes
supabase functions deploy verify-code

# 设置环境变量（在 Supabase Dashboard → Edge Functions）
# ai-proxy: OPENROUTER_API_KEY
```

### 5. 部署前端到 GitHub Pages

1. 创建 GitHub 仓库
2. 推送代码到仓库
3. Settings → Pages → Source: main branch, root directory → Save

### 6. 配置管理员

在 Supabase SQL Editor 中执行：

```sql
UPDATE members SET is_admin = true WHERE id = '你的用户UUID';
```

## 文件结构

```
D:\AI聚合大模型\
├── index.html                         # SPA 入口
├── css/
│   └── style.css                      # 商业级暗色主题样式
├── js/
│   ├── supabase.js                    # Supabase 客户端初始化
│   ├── utils.js                       # 全局工具函数库
│   ├── models.js                      # AI 模型配置 (50+)
│   ├── api.js                         # OpenRouter API 封装
│   ├── auth.js                        # 用户认证模块
│   ├── member.js                      # 会员 VIP 模块
│   ├── chat.js                        # AI 聊天核心模块
│   ├── admin.js                       # 管理后台模块
│   └── app.js                         # 应用主控制器 + SPA 路由
├── admin/
│   └── index.html                     # 管理员快捷入口
├── supabase/
│   ├── schema.sql                     # 数据库完整建表语句
│   ├── seed.sql                       # 初始种子数据
│   └── edge-functions/
│       ├── ai-proxy/index.ts          # AI 代理函数
│       ├── generate-codes/index.ts    # 生成会员码函数
│       └── verify-code/index.ts       # 验证会员码函数
├── setup.bat                          # Windows 一键配置脚本
├── .gitignore                         # Git 忽略规则
└── README.md                          # 项目文档
```

## 环境变量

| 变量名 | 说明 | 位置 |
|--------|------|------|
| `SUPABASE_URL` | Supabase 项目 URL | `js/supabase.js` |
| `SUPABASE_ANON_KEY` | Supabase 匿名公钥 | `js/supabase.js` |
| `OPENROUTER_API_KEY` | OpenRouter API 密钥 | Edge Function 环境变量 |

## 会员体系

| 等级 | 价格 | 调用次数 | 可用模型 | 自定义 Key |
|------|------|----------|----------|-----------|
| 免费用户 | 免费 | 20次/天 | 免费模型 | 否 |
| 月卡 VIP | 99元/月 | 无限 | 全部 | 否 |
| 年卡 VIP | 699元/年 | 无限 | 全部 | 是 |

## 常见问题

**Q: 如何获取 OpenRouter API Key？**  
A: 访问 [openrouter.ai/keys](https://openrouter.ai/keys) 注册后创建。

**Q: 本地模式能用吗？**  
A: 可以。未配置 Supabase 时自动降级到 localStorage 模拟模式，AI 对话使用模拟回复。配置 API Key 后启用真实对话。

**Q: 如何生成会员码？**  
A: 登录年卡 VIP 账号 → 管理后台 → 会员码管理 → 选择等级和数量生成。

**Q: 如何自定义模型列表？**  
A: 编辑 `js/models.js` 中的 `ALL_MODELS` 数组。

## 开发计划

- [x] 用户注册/登录/注销
- [x] 会员 VIP 体系
- [x] 50+ 模型聚合
- [x] 流式聊天对话
- [x] 管理后台
- [ ] 图像/文件上传
- [ ] 多语言支持
- [ ] 用量统计可视化
- [ ] 模型对比模式
- [ ] 提示词模板市场
*（内容由AI生成，仅供参考）*
