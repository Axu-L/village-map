# 村智图 VillageMap — 最终审计修复计划

## 概述

在完成前几轮修复（Stage A-D）后，对项目进行全面复查，发现 **1 个阻塞性构建错误 + 8 个 P1 问题 + 4 个 P2 问题**，共 13 项。本计划分 4 个阶段修复，最终通过 `tsc + lint + build + seed` 全链路验证。

---

## 当前状态分析

### 已完成（前几轮）
- P0: `.gitignore` 安全加固、上传照片 Referer 校验 + noindex
- P1: `initAMap` 插件合并、MapContainer deviceorientation 泄漏、RoutePlan 异步取消、Topbar mountedRef
- P1: `safeJsonParse`、`lastVisitAt` 条件更新、登录限流、NaN 校验（households/[id]）
- P2: `Tag[]` 类型、`ApiError`、`lib/validate.ts`、aria-label、死代码清理（cn/SearchInput/recharts）

### 遗留问题（本轮修复）

| 级别 | 问题 | 文件 |
|------|------|------|
| **P0** | Edge Runtime 构建失败：middleware → auth → db 使用 `process.cwd()` | `lib/auth.ts`, `middleware.ts` |
| **P1** | `members/[id]` PUT/DELETE 缺少 NaN 校验 | `api/members/[id]/route.ts` |
| **P1** | `drizzle.config.json` dialect 写成 postgresql，实际用 sqlite | `drizzle.config.json` |
| **P1** | `.gitignore` 引用 `!.env.example` 但文件不存在 | `.env.example`（缺失） |
| **P1** | `apiFetch` 遇 401 不跳转登录页，用户看到反复报错 | `lib/api.ts` |
| **P1** | 死代码：`lib/theme.ts` 无人引用 | `lib/theme.ts` |
| **P1** | 死代码：`lib/hooks/useHouseholds.ts` 无人引用 | `lib/hooks/useHouseholds.ts` |
| **P1** | 死导入：`Toast.tsx` 的 `useEffect` | `components/ui/Toast.tsx` |
| **P1** | 死导入：`VisitForm.tsx` 的 `Image` | `components/visit/VisitForm.tsx` |
| **P2** | 标签状态类型用 `string[]` 而非 `Tag[]` | 5 个文件 |
| **P2** | `getHouseholdColor(tags: string[])` 应为 `Tag[]` | `lib/tags.ts` |
| **P2** | 登录页不检测已登录用户，不自动跳转 | `login/page.tsx` |
| **P2** | MapContainer 卸载时未取消 `speechSynthesis` | `MapContainer.tsx` |

---

## 修复方案

### 阶段 A：P0 构建阻塞修复

**问题**：`middleware.ts` 运行在 Edge Runtime，但它导入的 `lib/auth.ts` 依赖 `db/index.ts`（使用 `process.cwd()` + `fs`），导致 `next build` 失败。

**方案**：将 `lib/auth.ts` 拆分为两个文件：

#### A1. 新建 `src/lib/jwt.ts`（Edge 安全，不含 db 导入）
- 从 `lib/auth.ts` 移出以下内容到 `lib/jwt.ts`：
  - `JWT_SECRET` / `SECRET` / `JWT_EXPIRES_IN` 常量
  - `AuthUser` 接口
  - `signToken(user: AuthUser): string`
  - `verifyToken(token: string): AuthUser | null`
  - `getAuthUser(request: Request): AuthUser | null`
- 此文件**只导入** `jsonwebtoken`，不导入 `db`，可在 Edge Runtime 运行

#### A2. 修改 `src/lib/auth.ts`（保留 db 依赖函数）
- 从 `lib/jwt.ts` re-export `signToken`、`verifyToken`、`getAuthUser`、`AuthUser`（保持向后兼容）
- 保留：`hashPassword`、`comparePassword`、`findUserByUsername`（这些需要 db）
- 删除已移走的 JWT 常量和函数定义

#### A3. 修改 `src/middleware.ts`
- 将 `import { verifyToken } from "@/lib/auth"` 改为 `import { verifyToken } from "@/lib/jwt"`
- 这样 middleware 的导入链不再触及 `db/index.ts`

#### A4. `src/app/api/auth/route.ts` 无需改动
- 它从 `@/lib/auth` 导入 `findUserByUsername, comparePassword, signToken`
- `lib/auth.ts` re-export 了 `signToken`，所以兼容

---

### 阶段 B：P1 正确性修复

#### B1. `src/app/api/members/[id]/route.ts` — 补 NaN 校验
- PUT 和 DELETE 的 `Number(id)` 后加 `isNaN` 检查，返回 400
- 与 `households/[id]/route.ts` 保持一致

#### B2. `drizzle.config.json` — 修正 dialect
- 将 `"dialect": "postgresql"` 改为 `"dialect": "sqlite"`
- 将 `dbCredentials.url` 改为 `"data/app.db"`（SQLite 文件路径）
- 与 `db/index.ts` 的 `path.join(process.cwd(), "data", "app.db")` 一致

#### B3. 创建 `.env.example`
- 包含项目所需的所有环境变量占位符：
  - `NEXT_PUBLIC_AMAP_KEY=your_amap_key_here`
  - `NEXT_PUBLIC_AMAP_SECRET=your_amap_secret_here`
  - `JWT_SECRET=your_jwt_secret_here`
- 不包含 `DATABASE_URL`（项目用 SQLite，不需要）

#### B4. `src/lib/api.ts` — 401 全局处理
- 在 `apiFetch` 中，当 `res.status === 401` 时：
  - 清除 `localStorage` 中的 `token` 和 `user`
  - 跳转到 `/login`（仅浏览器环境）
  - 然后再 throw `ApiError`

#### B5. 删除死代码文件
- 删除 `src/lib/theme.ts`（无人引用）
- 删除 `src/lib/hooks/useHouseholds.ts`（无人引用）
- 如果 `src/lib/hooks/` 目录变空，删除空目录

#### B6. 清理死导入
- `src/components/ui/Toast.tsx`：从 import 中移除 `useEffect`
- `src/components/visit/VisitForm.tsx`：从 import 中移除 `Image`

---

### 阶段 C：P2 类型安全与体验优化

#### C1. 标签类型统一为 `Tag[]`
以下文件中的 `string[]` 改为 `Tag[]`：

| 文件 | 位置 | 改动 |
|------|------|------|
| `src/lib/tags.ts` | `getHouseholdColor(tags: string[])` | 改为 `tags: Tag[]`，加 `import type { Tag }` |
| `src/components/map/MapToolbar.tsx` | `filterTags: string[]` / `onFilterChange: (tags: string[]) => void` | 改为 `Tag[]`，加 import |
| `src/components/household/HouseholdForm.tsx` | `useState<string[]>` / `toggleTag(tag: string)` | 改为 `Tag[]` / `Tag`，加 import |
| `src/app/(dashboard)/map/page.tsx` | `useState<string[]>` for filterTags | 改为 `Tag[]`，加 import |
| `src/app/(dashboard)/transfer/page.tsx` | `ParsedRow.tags: string[]` | 改为 `Tag[]`，加 import |
| `src/app/(dashboard)/household/[id]/page.tsx` | `selectedTags: string[]` / `toggleTag(tag: string)` | 改为 `Tag[]` / `Tag`，加 import |

#### C2. `src/app/login/page.tsx` — 已登录跳转
- 添加 `useEffect`：检查 `localStorage.getItem("token")`，若存在则 `router.replace("/map")`

#### C3. `src/components/map/MapContainer.tsx` — 卸载时取消语音
- 在初始化 useEffect 的 cleanup return 中添加：
  ```ts
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  ```

---

### 阶段 D：验证

1. `npx tsc --noEmit` — 类型检查通过
2. `npm run lint` — 确认无新增 lint 错误（预存的 `react-hooks/set-state-in-effect` 属于既有问题，不在本次范围）
3. `npm run build` — **必须成功**（核心目标：修复 Edge Runtime 构建错误）
4. `npx tsx scripts/seed-admin.ts` — 种子脚本可正常运行

---

## 假设与决策

1. **不修复 `react-hooks/set-state-in-effect` lint 警告**：这些是 React 19 新规则，涉及 `household/[id]/page.tsx`（读 URL 参数触发编辑）、`map/page.tsx`（读 URL 参数触发新增）、`(dashboard)/layout.tsx`（客户端鉴权检查），都是合理的派生状态模式，改造成本高且非阻塞。
2. **`lib/auth.ts` 保留 re-export**：避免破坏 `api/auth/route.ts` 的现有导入，保持向后兼容。
3. **不删除 `drizzle.config.json`**：改为修正 dialect，保留供未来 `drizzle-kit` 使用。
4. **`apiFetch` 401 处理仅限浏览器**：SSR 环境无 `window`，跳过。
5. **Tag 类型改动范围**：仅改 state/props 类型，不改 `Tag` 类型定义本身。

---

## 涉及文件清单

| 阶段 | 操作 | 文件 |
|------|------|------|
| A | 新建 | `src/lib/jwt.ts` |
| A | 修改 | `src/lib/auth.ts` |
| A | 修改 | `src/middleware.ts` |
| B | 修改 | `src/app/api/members/[id]/route.ts` |
| B | 修改 | `drizzle.config.json` |
| B | 新建 | `.env.example` |
| B | 修改 | `src/lib/api.ts` |
| B | 删除 | `src/lib/theme.ts` |
| B | 删除 | `src/lib/hooks/useHouseholds.ts` |
| B | 修改 | `src/components/ui/Toast.tsx` |
| B | 修改 | `src/components/visit/VisitForm.tsx` |
| C | 修改 | `src/lib/tags.ts` |
| C | 修改 | `src/components/map/MapToolbar.tsx` |
| C | 修改 | `src/components/household/HouseholdForm.tsx` |
| C | 修改 | `src/app/(dashboard)/map/page.tsx` |
| C | 修改 | `src/app/(dashboard)/transfer/page.tsx` |
| C | 修改 | `src/app/(dashboard)/household/[id]/page.tsx` |
| C | 修改 | `src/app/login/page.tsx` |
| C | 修改 | `src/components/map/MapContainer.tsx` |
| D | 验证 | tsc + lint + build + seed |
