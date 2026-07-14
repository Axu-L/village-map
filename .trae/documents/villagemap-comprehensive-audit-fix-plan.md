# 村智图项目全面审计修复计划（第三轮）

## 摘要

在完成前两轮修复（Phases 1-4, 6 已完成，Phase 5 部分完成）后，本次对全项目做了全面复查，共发现 **28 个遗留/新问题**：

- **P0 严重**：2 项（凭据 gitignore 缺失、上传照片公开可访问）
- **P1 高**：11 项（React 反模式 7 项 + 安全/数据完整性 4 项）
- **P2 中**：15 项（代码清理 + 可访问性 + 输入校验）

本计划聚焦**可直接修复**的问题，将架构级改造（JWT 改 HttpOnly Cookie、角色鉴权、分页等）列为"延后项"文档记录，不在本轮实施。

---

## 一、当前状态分析

### 已完成（前两轮）
- Phase 1: apiFetch 迁移（8 个客户端文件）✅
- Phase 2: middleware 收紧 GET 鉴权 ✅
- Phase 3: visits POST 同步 lastVisitAt ✅（但逻辑有 bug，本轮修复）
- Phase 4: JWT_SECRET 生产强制 + MapContainer escapeHtml ✅
- Phase 6: HouseholdForm NaN 守卫 + VisitForm visitor 默认值 + 编辑保存死循环修复 ✅
- Phase 5 部分: Toast useRef 计数器修复 ✅

### 本轮需修复

#### P0 — 严重
| # | 问题 | 文件:行 |
|---|------|---------|
| 1 | `.gitignore` 未忽略 `.env*`，JWT_SECRET/AMAP 密钥可能入库 | `.gitignore` |
| 2 | 上传照片存 `public/uploads/`，middleware matcher 仅 `/api/*`，照片无鉴权公开可访问 | `upload/route.ts:18,60` + `middleware.ts:43` |

#### P1 — 高
| # | 问题 | 文件:行 |
|---|------|---------|
| 3 | MapContainer `deviceorientation` 监听未在 cleanup 移除（内存泄漏） | `MapContainer.tsx:267` 添加 / `305-314` cleanup 缺失 |
| 4 | MapContainer 硬编码 `10000`（定位超时+轮询间隔）未用 `GEOLOCATION_INTERVAL` | `MapContainer.tsx:178,652` |
| 5 | MapContainer 硬编码 `50`（走访阈值）未用 `VISIT_ARRIVE_THRESHOLD` | `MapContainer.tsx:237` |
| 6 | 4 个组件直接 `import("@amap/amap-jsapi-loader")` 未用 `initAMap` 单例 | `MapContainer:110` / `RoutePlan:30` / `MapSettingsPicker:41` / `Topbar:38` |
| 7 | RoutePlan useEffect 无 `cancelled` 标志（卸载后 setState） | `RoutePlan.tsx:29-76` |
| 8 | RoutePlan 硬编码回退坐标 `{114.34, 30.52}` 与 `DEFAULT_CENTER` 不一致 | `RoutePlan.tsx:67,72` |
| 9 | Topbar 无 `mountedRef`（卸载后 setState） | `Topbar.tsx:36-96` |
| 10 | `parseRow` 用 `JSON.parse` 无 try/catch，脏数据导致整个 GET 500 | `db-utils.ts:11-13` |
| 11 | visits POST 无条件覆盖 `lastVisitAt`，补录更早走访会倒退时间 | `visits/route.ts:45-48` |
| 12 | 登录接口无速率限制，可暴力破解 | `api/auth/route.ts` |

#### P2 — 中
| # | 问题 | 文件:行 |
|---|------|---------|
| 13 | `tags` 类型用 `string[]` 而非 `Tag[]`，类型约束失效 | `types/index.ts:21,50` |
| 14 | Household/Member 类型缺 `createdAt?: string` | `types/index.ts:13-27,43-51` |
| 15 | `cn()` 函数死代码 | `lib/utils.ts:8-10` |
| 16 | `SearchInput.tsx` 整个组件死代码 | `components/ui/SearchInput.tsx` |
| 17 | `recharts` 死依赖 | `package.json:22` |
| 18 | Sidebar 未使用导入 `Bell`、`Download` | `Sidebar.tsx:7,10` |
| 19 | API 路由参数 `Number(id)` 无 NaN 校验 | `households/[id]/route.ts:14,68,86` |
| 20 | `openNavigation` 直接 `window.open` 无 SSR 守卫 | `db-utils.ts:31` |
| 21 | MobileNav 用 `Menu` 图标表示设置页（语义错误） | `MobileNav.tsx:12` |
| 22 | 7 处图标按钮缺 `aria-label` | `Modal/HouseholdForm/VisitForm/RoutePlan/HouseholdDrawer/Topbar/map page` |
| 23 | API 输入校验缺失（lat/lng 范围、phone 格式、memberCount、age、gender、visitDate、groupName） | `households/route.ts` / `visits/route.ts` / `members/route.ts` |
| 24 | Topbar 通知按钮占位无 disabled | `Topbar.tsx:158` |
| 25 | Sidebar 村庄切换按钮占位无 disabled | `Sidebar.tsx:52` |
| 26 | `next.config.ts` 缺安全响应头（CSP/X-Frame-Options 等） | `next.config.ts` |
| 27 | `apiFetch` 返回 `any` 丢类型；错误分支丢 HTTP 状态码 | `lib/api.ts:33,46-54` |
| 28 | `package.json` name 为 `nextjs-postgresql-template` 误导 | `package.json:2` |

---

## 二、修复方案

### 阶段 A：P0 安全紧急修复

#### A1. `.gitignore` 补充环境变量与上传目录
**文件**: `/workspace/.gitignore`
**操作**: 在文件末尾追加
```
# environment variables
.env*
!.env.example

# user uploads (runtime-generated, must not be committed)
public/uploads/
```
**原因**: `.env.local` 含 JWT_SECRET 与高德密钥，若入库即凭据泄露；`public/uploads/` 为运行时用户上传的敏感照片，不应入库。
**注意**: 实施时先执行 `git status` 确认 `.env.local` 是否已被 tracked；若已 tracked 需 `git rm --cached .env.local`。

#### A2. 上传照片鉴权化
**文件**:
- 新增 `/workspace/src/app/api/uploads/[filename]/route.ts`
- 修改 `/workspace/src/app/api/upload/route.ts`（存储路径改为 `public` 之外）
- 修改 `/workspace/src/middleware.ts`（`PROTECTED_PREFIXES` 增加 `"/api/uploads"`）

**方案**: 采用"签名 URL"轻量方案，避免改造 Bearer token 架构：
1. 上传文件存储到 `public/uploads/`（保持不变，UUID 命名不可枚举）
2. **在 `next.config.ts` 配置安全头** + **middleware 扩展 matcher 覆盖 `/uploads/:path*`**：对 `/uploads/*` 静态资源请求校验 Referer 同源（防止外站直接引用），并在响应头加 `X-Robots-Tag: noindex`
3. **文档记录**: UUID 文件名 + 同源 Referer 校验 + noindex 构成纵深防御；完整的 token 鉴权图片加载需改 HttpOnly Cookie 架构，列为延后项

**决策依据**: `<img src>` 标签无法携带自定义 Authorization 头，纯 Bearer token 架构下无法对图片做服务端 token 校验（除非用 query-param token，但会被日志记录）。同源 Referer 校验是当前架构下的最佳折中。

> **若不采纳此方案，则保持现状（UUID 不可枚举）并仅加 `.gitignore` + `noindex` 头。**

---

### 阶段 B：P1 React 反模式修复（Phase 5 收尾）

#### B1. MapContainer.tsx — deviceorientation 清理 + 常量 + initAMap
**文件**: `/workspace/src/components/map/MapContainer.tsx`

**修改点**:
1. **第 110-128 行**: 替换 `import("@amap/amap-jsapi-loader")...` 为 `initAMap(["AMap.Scale", "AMap.Geolocation", "AMap.ControlBar", "AMap.Geocoder", "AMap.Driving", "AMap.Walking", "AMap.Riding", "AMap.PlaceSearch"])`，删除手动 `window._AMapSecurityConfig` 和 `AMapLoader.default.load`
2. **第 252-269 行**: 将 `handleOrientation` 提升到 `useEffect` 顶层作用域，存入 `handleOrientationRef`，在 cleanup 中 `window.removeEventListener("deviceorientation", handleOrientationRef.current)`
3. **第 237 行**: `if (dist <= 50)` → `if (dist <= VISIT_ARRIVE_THRESHOLD)`
4. **第 178 行**: `timeout: 10000` → `timeout: GEOLOCATION_INTERVAL`
5. **第 652 行**: `}, 10000)` → `}, GEOLOCATION_INTERVAL)`
6. **import 行**: 添加 `import { initAMap } from "@/lib/amap";` 和 `import { GEOLOCATION_INTERVAL, VISIT_ARRIVE_THRESHOLD } from "@/lib/constants";`

#### B2. RoutePlan.tsx — cancelled + initAMap + DEFAULT_CENTER
**文件**: `/workspace/src/components/map/RoutePlan.tsx`

**修改点**:
1. **第 29-76 行 useEffect**: 添加 `let cancelled = false;`，在 `geolocation.getCurrentPosition` 回调和 `.catch` 中检查 `if (cancelled) return;`，cleanup 返回 `() => { cancelled = true; }`
2. **第 30-37 行**: 替换直接 import 为 `initAMap(["AMap.Geocoder", "AMap.Geolocation"])`
3. **第 67, 72 行**: `{ lng: 114.34, lat: 30.52 }` → `{ lng: DEFAULT_CENTER[0], lat: DEFAULT_CENTER[1] }`
4. **import 行**: 添加 `import { initAMap, DEFAULT_CENTER } from "@/lib/amap";`

#### B3. MapSettingsPicker.tsx — initAMap
**文件**: `/workspace/src/components/map/MapSettingsPicker.tsx`

**修改点**:
1. **第 41-51 行**: 替换 `import("@amap/amap-jsapi-loader")...AMapLoader.default.load(...)` 为 `initAMap(["AMap.Geocoder", "AMap.Geolocation"])`，删除手动 securityConfig
2. **import 行**: 添加 `import { initAMap } from "@/lib/amap";`（已有 `getMapSettings, saveMapSettings, DEFAULT_CENTER, DEFAULT_ZOOM`）

#### B4. Topbar.tsx — mountedRef + initAMap + 通知按钮
**文件**: `/workspace/src/components/layout/Topbar.tsx`

**修改点**:
1. **第 36-50 行 `ensureAutoComplete`**: 替换直接 import 为 `initAMap(["AMap.AutoComplete"])`，删除手动 securityConfig
2. **添加 `mountedRef`**: `const mountedRef = useRef(true);` + useEffect cleanup `mountedRef.current = false;`；在 `handleSearch` 的 `.then` 回调中 `if (!mountedRef.current) return;` 再调用 `setTips`/`setShowTips`
3. **第 158 行通知按钮**: 添加 `disabled` + `title="通知功能开发中"` + `aria-label="通知（未启用）"`

---

### 阶段 C：P1 数据完整性与安全

#### C1. parseRow JSON.parse 容错
**文件**: `/workspace/src/lib/db-utils.ts` (第 8-15 行)

**修改**: 抽取 `safeJsonParse(s)` 辅助函数，包裹 try/catch 回退 `[]`：
```typescript
function safeJsonParse(s: unknown): unknown[] {
  if (typeof s !== "string") return Array.isArray(s) ? s : [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
```
`parseRow` 中 `tags/concerns/images` 改用 `safeJsonParse(row.tags)` 等。

#### C2. visits POST lastVisitAt 条件更新
**文件**: `/workspace/src/app/api/visits/route.ts` (第 44-48 行)

**修改**: 仅当新走访日期 >= 现有 lastVisitAt 时才更新：
```typescript
// 同步更新住户的最近走访时间（仅当本次走访更新或更晚时）
const [household] = await db.select({ lastVisitAt: households.lastVisitAt })
  .from(households).where(eq(households.id, Number(body.householdId)));
if (household && (!household.lastVisitAt || body.visitDate >= household.lastVisitAt)) {
  await db.update(households)
    .set({ lastVisitAt: body.visitDate })
    .where(eq(households.id, Number(body.householdId)));
}
```

#### C3. 登录速率限制（内存 Map）
**文件**: `/workspace/src/app/api/auth/route.ts`

**修改**: 新增基于 IP 的简单限流（5 次/分钟，失败后冷却 60s）：
```typescript
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (record && record.lockedUntil > now) {
    return Response.json({ message: "尝试过于频繁，请 1 分钟后再试" }, { status: 429 });
  }
  // ... existing login logic ...
  // 登录失败时:
  //   const r = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  //   r.count++;
  //   if (r.count >= MAX_ATTEMPTS) { r.lockedUntil = now + LOCK_MS; r.count = 0; }
  //   loginAttempts.set(ip, r);
  // 登录成功时: loginAttempts.delete(ip);
}
```
**注意**: 内存方案重启即失效，单实例够用；多实例需换 Redis。文档记录此限制。

#### C4. API 路由参数 NaN 校验
**文件**: `/workspace/src/app/api/households/[id]/route.ts` (第 14, 68, 86 行)

**修改**: 在每个 handler 开头添加：
```typescript
const idNum = Number(id);
if (isNaN(idNum)) {
  return Response.json({ message: "无效的 ID" }, { status: 400 });
}
```
然后用 `idNum` 替换 `Number(id)`。

---

### 阶段 D：P2 代码清理与可访问性（Phase 7）

#### D1. 类型完善
**文件**: `/workspace/src/types/index.ts`
- 第 21 行: `tags: string[]` → `tags: Tag[]`
- 第 50 行: `tags: string[]` → `tags: Tag[]`
- Household 接口添加 `createdAt?: string`
- Member 接口添加 `createdAt?: string`

#### D2. 删除死代码
- **删除文件**: `/workspace/src/components/ui/SearchInput.tsx`
- **删除函数**: `/workspace/src/lib/utils.ts` 第 8-10 行 `cn()` 函数（保留 `maskPhone`）
- **卸载依赖**: `npm uninstall recharts`
- **清理导入**: `/workspace/src/components/layout/Sidebar.tsx` 第 7 行删 `Bell`、第 10 行删 `Download`

#### D3. openNavigation SSR 守卫
**文件**: `/workspace/src/lib/db-utils.ts` (第 29-35 行)
```typescript
export function openNavigation(lng: number, lat: number, name: string): void {
  if (typeof window === "undefined") return;
  const encodedName = encodeURIComponent(name);
  window.open(
    `https://uri.amap.com/navigation?to=${lng},${lat},${encodedName}`,
    "_blank"
  );
}
```

#### D4. MobileNav 图标语义修复
**文件**: `/workspace/src/components/layout/MobileNav.tsx`
- 第 5 行 import: 添加 `Settings`，删除 `Menu`
- 第 12 行: `icon: Menu` → `icon: Settings`

#### D5. 图标按钮 aria-label
为以下 7 处图标按钮添加 `aria-label`：
| 文件 | 行 | aria-label |
|------|----|-----------|
| `Modal.tsx` | 29 | `aria-label="关闭"` |
| `HouseholdForm.tsx` | 81 | `aria-label="关闭"` |
| `VisitForm.tsx` | 112 | `aria-label="关闭"` |
| `RoutePlan.tsx` | 148 | `aria-label="关闭"` |
| `HouseholdDrawer.tsx` | 39 | `aria-label="关闭"` |
| `Topbar.tsx` | 158 | `aria-label="通知（未启用）"` (配合 disabled) |
| `map/page.tsx` | 279 | `aria-label="关闭"` |

#### D6. Sidebar 村庄切换按钮禁用
**文件**: `/workspace/src/components/layout/Sidebar.tsx` (第 52 行)
```tsx
<button className="village-switch" disabled title="多村庄切换功能开发中">花园村村委会 <ChevronDown size={15} /></button>
```

#### D7. next.config.ts 安全响应头
**文件**: `/workspace/next.config.ts`
添加 `headers()` 配置：
```typescript
async headers() {
  return [{
    source: "/(.*)",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-XSS-Protection", value: "1; mode=block" },
    ],
  }];
}
```

#### D8. apiFetch 类型与错误改进
**文件**: `/workspace/src/lib/api.ts`
- 错误分支保留 HTTP 状态码：自定义 `ApiError extends Error` 带 `status` 字段
- 成功分支 `res.json()` 包裹 try/catch，非 JSON 返回 `null`

#### D9. API 输入校验（核心字段）
**文件**: `households/route.ts` / `visits/route.ts` / `members/route.ts`

新增 `lib/validate.ts` 集中校验函数：
```typescript
export function validateLat(v: string): boolean {
  const n = Number(v); return !isNaN(n) && n >= -90 && n <= 90;
}
export function validateLng(v: string): boolean {
  const n = Number(v); return !isNaN(n) && n >= -180 && n <= 180;
}
export function validatePhone(v: string): boolean {
  return /^1[3-9]\d{9}$/.test(v) || v === "";
}
export function validateGroupName(v: string): boolean {
  return GROUP_NAMES.includes(v as any);
}
```
在各 POST/PUT handler 中调用，校验失败返回 400 + 具体字段提示。

#### D10. package.json 名称修正
**文件**: `/workspace/package.json` (第 2 行)
`"name": "nextjs-postgresql-template"` → `"name": "village-map"`

---

### 阶段 E：最终验证

1. `npx tsc --noEmit` — 无类型错误
2. `npm run lint` — 无 lint 错误
3. `npm run build` — 构建成功
4. `npx tsx scripts/seed-admin.ts` — 种子脚本可执行（验证无回归）
5. 手动抽查：登录限流触发 429、parseRow 脏数据不 500、lastVisitAt 补录早日期不倒退

---

## 三、延后项（文档记录，不在本轮实施）

| 项 | 原因 |
|----|------|
| JWT 改 HttpOnly Cookie + refresh token | 架构级改造，影响所有 API + 前端鉴权流 |
| 角色鉴权（role-based） | 功能扩展，需定义权限矩阵 |
| 列表 API 分页 | 功能扩展，需前后端配合 |
| 注册/用户管理接口 | 当前单管理员 seed 模式够用 |
| lat/lng schema 从 text 改 real | 需数据迁移脚本 |
| 上传图片完整 token 鉴权 | 需配合 HttpOnly Cookie 改造 |
| Dashboard 服务端鉴权守卫 | 需配合 Cookie 改造 |
| Marker HTML 改 DOM API 渲染 | 大重构，当前 escapeHtml 已缓解 |

---

## 四、假设与决策

1. **initAMap 单例**：`lib/amap.ts` 已有 `initAMap(plugins)` + `amapPromise` 缓存，不同组件传不同 plugins 数组会合并去重（已确认实现），4 个组件迁移后共享单例。
2. **登录限流用内存 Map**：单实例部署够用，重启清空可接受。多实例需 Redis，文档记录。
3. **上传照片保持 `public/uploads/`**：纯 Bearer token 架构下 `<img>` 无法携带自定义头，完整鉴权需 Cookie 改造（延后）。本轮加同源 Referer 校验 + noindex 头作为纵深防御。
4. **输入校验范围**：仅校验核心字段（lat/lng/phone/memberCount/age/gender/visitDate/groupName），不做全量 schema 校验库（如 zod）引入，保持轻量。
5. **Tag[] 类型**：`constants.ts` 的 `GROUP_NAMES` 是 `as const`，`Tag` 类型已在 `types/index.ts` 定义，替换 `string[]` 后需确认所有 `tags` 赋值点类型兼容。

---

## 五、实施顺序

1. **阶段 A**（P0 安全）→ A1 gitignore, A2 上传照片
2. **阶段 B**（P1 React）→ B1 MapContainer, B2 RoutePlan, B3 MapSettingsPicker, B4 Topbar
3. **阶段 C**（P1 数据/安全）→ C1 parseRow, C2 lastVisitAt, C3 登录限流, C4 NaN 校验
4. **阶段 D**（P2 清理）→ D1-D10
5. **阶段 E**（验证）→ tsc + lint + build + seed
