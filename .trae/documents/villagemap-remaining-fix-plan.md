# 村智图项目剩余问题修复计划（第二轮审计）

## Summary

对 /workspace VillageMap 项目进行第二轮全面审计后，发现 **36 个剩余/新增问题**（3 个 P0、9 个 P1、24 个 P2）。Stage 1-3（基础设施、鉴权、API 路由）已正确完成，但 Stage 4-8 尚未开始，且 Stage 2 引入的 middleware 导致了一个 **P0 级回归故障**：所有写操作因页面仍用裸 `fetch()`（未携带 Authorization 头）而被 middleware 拒绝（401）。

此外发现原审计未覆盖的新安全问题：GET 请求绕过鉴权暴露敏感人群数据、MapContainer marker 存储型 XSS、JWT_SECRET 生产兜底值不安全。

本计划覆盖全部 36 个问题的修复，分 8 个阶段执行。

**关键决策**（用户跳过澄清，采用推荐默认值）：
- GET 鉴权：收紧——`/api/households`、`/api/visits`、`/api/members` 的 GET 请求也要求 Bearer token；`/api/health`、`/api/auth` 保持开放
- recharts：卸载（统计页 CSS 图表已满足需求）

---

## Current State Analysis

### 已完成（Stage 1-3，经审计确认正确）
| 文件 | 内容 |
|------|------|
| `src/lib/constants.ts` | VISIT_ARRIVE_THRESHOLD、GEOLOCATION_INTERVAL、MAX_UPLOAD_SIZE、GROUP_NAMES、getVisitorDefault |
| `src/lib/theme.ts` | COLORS 对象 |
| `src/lib/db-utils.ts` | parseRow、isValidLatLng、openNavigation |
| `src/lib/auth.ts` | JWT 签发/验证 + bcrypt 哈希/校验 |
| `src/lib/hooks/useHouseholds.ts` | 统一数据加载 hook（含 AbortController，但全局未使用） |
| `src/lib/amap.ts` | initAMap(plugins) 单例封装（但 4 个组件未复用） |
| `src/lib/api.ts` | apiFetch() 自动注入 token + res.ok 校验（但页面未使用） |
| `src/middleware.ts` | 拦截写操作（GET 放行——本计划收紧） |
| `src/app/api/auth/route.ts` | DB 查询用户 + bcrypt + JWT |
| `src/app/api/households/route.ts` | 移除 demo 数据 |
| `src/app/api/upload/route.ts` | crypto.randomUUID + 部分失败处理 |
| `scripts/seed-admin.ts` | bcrypt 哈希密码 |

### 待修复问题分布
| 类别 | P0 | P1 | P2 | 小计 |
|------|----|----|----|----|
| Stage 4 - 客户端数据加载 | 1 | 2 | 3 | 6 |
| Stage 5 - React 反模式 | 0 | 3 | 4 | 7 |
| Stage 6 - 严重 Bug | 1 | 2 | 0 | 3 |
| Stage 7 - 代码清理 | 0 | 0 | 6 | 6 |
| Stage 8 - 占位按钮 | 0 | 0 | 2 | 2 |
| 新发现 - 安全 | 1 | 2 | 2 | 5 |
| 新发现 - 架构/其他 | 0 | 0 | 7 | 7 |
| **合计** | **3** | **9** | **24** | **36** |

---

## Proposed Changes

### 阶段 1：P0 回归修复 — 客户端迁移到 apiFetch（问题 #1）

> 这是最高优先级：当前所有新增/编辑/删除/上传操作均 401 失败。

#### 1.1 map 页面
- **文件**：`/workspace/src/app/(dashboard)/map/page.tsx`
- **操作**：
  - 替换所有裸 `fetch(apiUrl(...))` 为 `apiFetch(...)`（POST 走访、POST 住户等）
  - GET 加载用 `apiFetch`（为后续 GET 鉴权收紧做准备）
  - catch 中调用 `toast("加载数据失败", "error")`（问题 #3）
  - `filtered` filter 前加类型守卫 `h && typeof h.headName === "string"`（问题 #6）
  - 走访到达阈值用 `VISIT_ARRIVE_THRESHOLD` 常量替换硬编码 50
  - `window.speechSynthesis` 调用前加 `"speechSynthesis" in window` 检查
- **注意**：`apiFetch` 已内置 res.ok 校验和错误 message 提取，调用方改 try/catch + toast

#### 1.2 people 页面
- **文件**：`/workspace/src/app/(dashboard)/people/page.tsx`
- **操作**：
  - GET/POST/PUT/DELETE 全部改用 `apiFetch`
  - `confirm()` 替换为 Modal 确认弹窗（import `Modal` from `@/components/ui/Modal`，本计划阶段 7 会保留 Modal 文件供此处复用）
  - hover 效果改用 CSS class（删除 inline `onMouseEnter`/`onMouseLeave` style 操纵）
  - 坐标校验用 `isValidLatLng`
  - catch 中 toast 错误 + `finally { setLoading(false) }`

#### 1.3 visits 页面
- **文件**：`/workspace/src/app/(dashboard)/visits/page.tsx`
- **操作**：
  - GET 改用 `apiFetch`
  - hover 效果改用 CSS class
  - catch 中 toast + finally setLoading

#### 1.4 statistics 页面
- **文件**：`/workspace/src/app/(dashboard)/statistics/page.tsx`
- **操作**：
  - `Promise.all` 中的两个 fetch 改用 `apiFetch`，分别 try/catch（问题 #10：一个失败不影响另一个）
  - 删除本地 `groupNames` 定义，`import { GROUP_NAMES } from "@/lib/constants"`（问题 #4）
  - 颜色 hex 改用 `COLORS` from `@/lib/theme`
  - catch 中 toast + finally setLoading

#### 1.5 transfer 页面
- **文件**：`/workspace/src/app/(dashboard)/transfer/page.tsx`
- **操作**：
  - GET 加载改用 `apiFetch`（问题 #13）
  - 导入循环中的 POST 改用 `apiFetch`（问题 #17）——注意 apiFetch 失败会 throw，需 try/catch 计入 failed
  - 导入后刷新列表改用 `apiFetch`（问题 #17，当前裸 fetch 未校验 res.ok）
  - catch 中 toast

#### 1.6 household/[id] 页面
- **文件**：`/workspace/src/app/(dashboard)/household/[id]/page.tsx`
- **操作**：
  - 所有 fetch 改用 `apiFetch`（GET household、GET visits、POST visit、POST member、PUT household、DELETE member 等）
  - `tags`/`concerns` 访问加 `Array.isArray()` 守卫（问题 #6）
  - `onSuccess` 回调 catch 中 toast
  - 导航逻辑用 `openNavigation` from `@/lib/db-utils`
  - 坐标校验用 `isValidLatLng`
  - 颜色用 `COLORS`

#### 1.7 VisitForm 组件
- **文件**：`/workspace/src/components/visit/VisitForm.tsx`
- **操作**：POST 走访、上传图片改用 `apiFetch`

#### 1.8 HouseholdForm 组件
- **文件**：`/workspace/src/components/household/HouseholdForm.tsx`
- **操作**：POST/PUT 住户改用 `apiFetch`；组名用 `GROUP_NAMES` 常量（问题 #5）

---

### 阶段 2：P0 安全 — 收紧 GET 鉴权（问题 #26）

- **文件**：`/workspace/src/middleware.ts`
- **操作**：
  - 移除 GET/HEAD/OPTIONS 直接放行的逻辑
  - 改为：仅 `/api/auth`、`/api/health` 放行；其余 `/api/households`、`/api/members`、`/api/visits`、`/api/upload` 所有方法（含 GET）均要求 Bearer token
  - matcher 保持 `["/api/:path*"]`
- **原因**：API 返回原始手机号、地址、GPS 坐标、敏感人群姓名，UI 脱敏在此完全失效
- **前置条件**：阶段 1 完成后所有页面已用 `apiFetch`（自动注入 token），收紧 GET 不会破坏已登录用户体验
- **放行白名单**：
  ```typescript
  const PUBLIC_PATHS = ["/api/auth", "/api/health"];
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isPublic) return NextResponse.next();
  ```

---

### 阶段 3：P0 数据完整性 — visits POST 更新 lastVisitAt（问题 #17）

- **文件**：`/workspace/src/app/api/visits/route.ts`
- **操作**：POST handler 在成功插入 visit 记录后，执行：
  ```typescript
  await db.update(households)
    .set({ lastVisitAt: body.visitDate })
    .where(eq(households.id, Number(body.householdId)));
  ```
- **原因**：households.lastVisitAt 字段在 UI 多处展示，但从未被更新，导致"最近走访"永远显示"暂无"
- **注意**：需 import `households` schema 和 `eq`（若未导入）

---

### 阶段 4：P1 安全修复

#### 4.1 MapContainer marker XSS 转义（问题 #27）
- **文件**：`/workspace/src/components/map/MapContainer.tsx`
- **操作**：
  - 新增 `escapeHtml(s: string)` 工具函数（转义 `< > " ' &`）
  - 对拼接进 marker HTML 的 `family.householdName`、`family.lastVisitImage` 转义
- **位置**：约第 404-409 行 marker content 拼接处

#### 4.2 JWT_SECRET 生产强制（问题 #28）
- **文件**：`/workspace/src/lib/auth.ts`
- **操作**：
  ```typescript
  const JWT_SECRET = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && !JWT_SECRET) {
    throw new Error("JWT_SECRET 必须在生产环境设置");
  }
  const SECRET = JWT_SECRET || "dev-insecure-secret-change-in-production";
  ```
- **原因**：防止生产环境使用默认密钥导致 token 可伪造

---

### 阶段 5：React 反模式修复

#### 5.1 MapContainer deviceorientation 监听泄漏（问题 #7，P1）
- **文件**：`/workspace/src/components/map/MapContainer.tsx`
- **操作**：
  - 将 `handleOrientation` 函数定义在 useEffect 作用域内（已是），用 ref 保存引用
  - cleanup 中添加 `window.removeEventListener("deviceorientation", handleOrientationRef.current)`
  - 硬编码 10000 改 `GEOLOCATION_INTERVAL`（问题 #8）
  - 硬编码 50 改 `VISIT_ARRIVE_THRESHOLD`（问题 #9）
  - 4 个组件 AMap 加载改用 `initAMap`（问题 #31）——MapContainer、RoutePlan、MapSettingsPicker、Topbar

#### 5.2 RoutePlan 异步取消（问题 #10，P1）
- **文件**：`/workspace/src/components/map/RoutePlan.tsx`
- **操作**：
  - useEffect 加 `let cancelled = false;`，setState 前判断
  - AMap 加载改用 `initAMap(["AMap.Geocoder", "AMap.Geolocation"])`
  - 默认坐标用 `DEFAULT_CENTER` from `@/lib/amap`（问题 #11）

#### 5.3 MapSettingsPicker 异步取消（已有 cancelled，补 initAMap）
- **文件**：`/workspace/src/components/map/MapSettingsPicker.tsx`
- **操作**：AMap 加载改用 `initAMap(["AMap.Geocoder"])`

#### 5.4 Topbar 竞态 + initAMap（问题 #12，P1）
- **文件**：`/workspace/src/components/layout/Topbar.tsx`
- **操作**：
  - 加 `mountedRef`，ensureAutoComplete 和 handleSearch 回调中检查
  - AMap 加载改用 `initAMap(["AMap.AutoComplete"])`

#### 5.5 Toast counter 改 useRef（问题 #13，P1）
- **文件**：`/workspace/src/components/ui/Toast.tsx`
- **操作**：
  ```typescript
  const counterRef = useRef(0);
  const toast = useCallback((message, type) => {
    const id = Date.now() + counterRef.current++;
    // ...
  }, []);
  ```
  - 容器添加 `role="status" aria-live="polite"`（问题 #35）

#### 5.6 HouseholdForm isNaN 守卫（问题 #14，P1）
- **文件**：`/workspace/src/components/household/HouseholdForm.tsx`
- **操作**：
  ```typescript
  const n = Number(e.target.value);
  setMemberCount(isNaN(n) ? 1 : Math.max(1, n));
  ```

---

### 阶段 6：P1 关键 Bug

#### 6.1 household/[id] 编辑保存死循环（问题 #15，P1）
- **文件**：`/workspace/src/app/(dashboard)/household/[id]/page.tsx`
- **操作**：`handleSaveEditHousehold` 成功后立即清除 URL `edit` 参数：
  ```typescript
  const url = new URL(window.location.href);
  url.searchParams.delete("edit");
  window.history.replaceState({}, "", url.pathname + url.search);
  ```
- **原因**：当前 effect 依赖 `[household]`，保存后 household 变化触发 effect 重开表单

#### 6.2 VisitForm visitor 默认值（问题 #16，P1）
- **文件**：`/workspace/src/components/visit/VisitForm.tsx`
- **操作**：
  ```typescript
  import { getVisitorDefault } from "@/lib/constants";
  const [visitor, setVisitor] = useState(getVisitorDefault());
  ```

---

### 阶段 7：代码清理

#### 7.1 类型完善（问题 #22、#23）
- **文件**：`/workspace/src/types/index.ts`
- **操作**：
  - `Household.tags`: `string[]` → `Tag[]`
  - `Member.tags`: `string[]` → `Tag[]`
  - `Household` 新增 `createdAt?: string`
  - `Member` 新增 `createdAt?: string`
  - `Visit.concerns` 保持 `string[]`（非 Tag 类型）

#### 7.2 删除未使用代码（问题 #18、#19、#21、#34）
- **文件与操作**：
  - `src/lib/utils.ts`：删除 `cn()` 函数（保留 `maskPhone`）
  - `src/components/ui/SearchInput.tsx`：删除整个文件
  - `src/components/layout/Sidebar.tsx`：移除未使用的 `Bell`、`Download` import
  - `package.json`：`npm uninstall recharts`

#### 7.3 Modal 文件保留（问题 #20 调整）
- **文件**：`src/components/ui/Modal.tsx`
- **决策**：**保留**（不删除）——阶段 1.2 people 页面的 `confirm()` 替换将复用此组件
- **操作**：确保 Modal 组件健壮（点击遮罩关闭、ESC 关闭、阻止滚动穿透）

#### 7.4 路由参数 NaN 校验（问题 #33）
- **文件**：`src/app/api/households/[id]/route.ts`、`src/app/api/members/[id]/route.ts`
- **操作**：
  ```typescript
  const numId = Number(id);
  if (isNaN(numId)) return Response.json({ message: "无效的 ID" }, { status: 400 });
  ```

#### 7.5 openNavigation SSR 安全（问题 #32）
- **文件**：`src/lib/db-utils.ts`
- **操作**：`openNavigation` 函数体首行加 `if (typeof window === "undefined") return;`

#### 7.6 MobileNav 图标语义（问题 #36）
- **文件**：`src/components/layout/MobileNav.tsx`
- **操作**："我的"标签图标从 `Menu` 改为 `Settings`，label 改为"设置"

#### 7.7 可访问性 aria-label（问题 #35）
- **文件**：MapContainer、household/[id]、people 页面的图标按钮
- **操作**：为仅含图标的 `<button>` 添加 `aria-label` 属性

#### 7.8 上传 MIME 嗅探（问题 #29）
- **文件**：`src/app/api/upload/route.ts`
- **操作**：保留现有 file.type 校验（magic bytes 嗅探需引入 file-type 库，收益有限，标记为后续优化）。当前确保扩展名白名单严格。

#### 7.9 登录速率限制（问题 #30）
- **文件**：`src/app/api/auth/route.ts`
- **操作**：基于内存 Map 的简单 IP 速率限制（每 IP 每分钟最多 5 次登录尝试），无需额外依赖
  ```typescript
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();
  // 在 POST handler 开头检查
  ```

---

### 阶段 8：占位按钮处理（问题 #24、#25）

#### 8.1 Topbar 通知按钮
- **文件**：`src/components/layout/Topbar.tsx`
- **操作**：通知 button 添加 `disabled` + `title="通知功能开发中"`，移除空 `<i />`

#### 8.2 Sidebar 村庄切换按钮
- **文件**：`src/components/layout/Sidebar.tsx`
- **操作**：village-switch button 添加 `disabled` + `title="村庄切换功能开发中"`

---

## Assumptions & Decisions

### 关键决策
1. **GET 鉴权收紧**：移除 GET 放行，所有敏感 API 均要求 token。前置依赖阶段 1 的 apiFetch 迁移完成。
2. **recharts 卸载**：统计页 CSS 图表已满足需求，减少打包体积。
3. **Modal 保留**：供 people 页面 confirm() 替换复用，不删除。
4. **速率限制用内存 Map**：单实例足够，无需 Redis/upstash 依赖。注意 standalone 部署多实例时不共享，但本项目为单实例。
5. **MIME 嗅探暂不实现**：file-type 库引入成本高于收益，扩展名白名单已提供基本防护。
6. **lastVisitAt 更新**：以 visitDate（用户选择的走访日期）为准，非 createdAt。

### 假设
- 阶段 1 的 apiFetch 迁移完成后，localStorage 中已有 token（登录流程已存储），收紧 GET 不会破坏已登录体验
- 未登录用户访问受保护页面时，apiFetch 返回 401，页面 catch 后应跳转登录页（本计划在阶段 1 各页面 catch 中补充：若 401 则 `router.push("/login")`）

### 不在本次范围
- 单元测试 / E2E 测试
- i18n 国际化
- PWA 离线支持
- 真正的多村庄切换功能（仅 disable 按钮）
- file-type magic bytes 嗅探

---

## Verification Steps

### 阶段性验证
1. **阶段 1 完成后**（P0 回归修复）：
   - 登录后新增/编辑/删除住户成功（不再 401）
   - 新增走访、上传图片成功
   - 各页面数据加载失败时显示 toast 而非白屏
2. **阶段 2 完成后**（GET 鉴权收紧）：
   - 未带 token 直接 `curl /api/households` 返回 401
   - 登录后页面正常加载（apiFetch 自动注入 token）
   - `/api/health` 无 token 仍可访问
3. **阶段 3 完成后**：
   - 新增走访后，对应住户的"最近走访"字段更新
4. **阶段 4 完成后**：
   - 创建户名为 `<img src=x>` 的住户，地图 marker 不执行脚本
   - 生产环境未设 JWT_SECRET 时启动报错
5. **阶段 5-6 完成后**：
   - 快速切换页面无控制台 "state update on unmounted component" 警告
   - household 详情页编辑保存后表单不重开
   - VisitForm 默认走访人为当前登录用户名
   - 同毫秒触发两个 toast 不互相覆盖
6. **阶段 7-8 完成后**：`npx tsc --noEmit` 无错误；`npm run lint` 无警告

### 最终验证
```bash
# 1. 类型检查
npx tsc --noEmit

# 2. ESLint
npm run lint

# 3. 构建测试
npm run build

# 4. 运行 seed 脚本确保 admin 用户存在
npx tsx scripts/seed-admin.ts

# 5. 启动并手动测试关键流程
npm run dev
# - 登录（正确/错误密码，错误密码连续 5 次后限流）
# - 未登录访问 /api/households 返回 401
# - 新增/编辑/删除住户
# - 新增走访后检查"最近走访"更新
# - 地图搜索位置、走访模式
# - household 详情页编辑保存后表单不重开
# - 统计页面、批量导入
```

### 回归测试清单
- [ ] 登录流程（含速率限制）
- [ ] 未登录 API 访问被拒（GET + POST）
- [ ] 住户 CRUD（含 memberCount=0 边界）
- [ ] 成员 CRUD（含 age 清空为 null）
- [ ] 走访记录 CRUD + 图片上传 + lastVisitAt 更新
- [ ] 统计页面数据正确（GROUP_NAMES 常量）
- [ ] 批量导入 CSV
- [ ] 地图 marker XSS 防护
- [ ] household 编辑保存无死循环
- [ ] 移动端布局
