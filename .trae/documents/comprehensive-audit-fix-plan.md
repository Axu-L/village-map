# 村智图项目全面审计修复计划

## Summary

对 /workspace Next.js 项目进行全面审计后，发现 77 个问题（4 个 P0 严重、18 个 P1 重要、55 个 P2 次要）。本计划覆盖全部问题的修复，并完整实现 JWT + bcrypt 鉴权系统（替换当前硬编码 admin/admin123）。

修复工作分 8 个阶段执行，按依赖顺序组织，避免同一文件被反复修改。

---

## Current State Analysis

### 项目现状
- **技术栈**：Next.js 16.2.6 (App Router) + React 19.2.6 + TypeScript 5.9.3 + Drizzle ORM + better-sqlite3 + AMap JSAPI v2.0
- **数据库**：SQLite，已有 `households`/`visits`/`members`/`users` 四张表（users 表已定义但未使用）
- **鉴权现状**：`src/app/api/auth/route.ts` 硬编码 `admin/admin123`，token 为 `demo-token-${Date.now()}` 无签名，API 路由完全不校验 token，登录页公开展示演示账号

### 问题分布概览
| 类别 | 数量 | 代表问题 |
|---|---|---|
| P0 严重 | 4 | 编辑保存死循环、deviceorientation 监听泄漏、token 无签名、硬编码密码 |
| P1 重要 | 18 | fetch 未校验 res.ok（8处）、useEffect 泄漏（3处）、API 逻辑缺陷（4处）、空指针风险 |
| P2 次要 | 55 | 未使用导入/导出（6处）、硬编码（8处）、DOM 操作（5处）、重复代码（5处）、类型不严 |

---

## Proposed Changes

### 阶段 1：基础设施（依赖、常量、共享工具）

#### 1.1 新增依赖
- **文件**：`/workspace/package.json`
- **操作**：新增 `jsonwebtoken`、`bcryptjs`、`@types/jsonwebtoken`、`@types/bcryptjs`
- **原因**：鉴权系统需要 JWT 签发与密码哈希校验
- **方式**：`npm install jsonwebtoken bcryptjs && npm install -D @types/jsonwebtoken @types/bcryptjs`

#### 1.2 创建共享常量文件
- **文件**：`/workspace/src/lib/constants.ts`（新建）
- **内容**：
  - `VISIT_ARRIVE_THRESHOLD = 50`（走访到达阈值米数，解决问题 #67）
  - `GEOLOCATION_INTERVAL = 10000`（定位间隔，解决问题 #68）
  - `MAX_UPLOAD_SIZE = 5 * 1024 * 1024`（上传大小限制，解决问题 #69）
  - `GROUP_NAMES`：10 个组名数组（解决问题 #65，统一 `HouseholdForm`、`statistics`、`people` 用）
  - `VISITOR_DEFAULT`：默认走访人（从 localStorage 读取，解决问题 #66）
- **原因**：消除多文件硬编码重复

#### 1.3 创建主题常量文件
- **文件**：`/workspace/src/lib/theme.ts`（新建）
- **内容**：导出 `COLORS = { blue: "#2f80ed", green: "#27ae60", orange: "#f2994a", red: "#eb5757", ink: "#16213c", muted: "#78849a" }`
- **原因**：消除 6+ 个页面中颜色 hex 硬编码（问题 #70）
- **方式**：各页面 `import { COLORS } from "@/lib/theme"` 替换硬编码

#### 1.4 创建统一 AMap 加载入口
- **文件**：`/workspace/src/lib/amap.ts`（修改）
- **操作**：重写 `initAMap(plugins: string[])` 函数，接受 plugins 参数，返回 Promise<AMap>
- **原因**：消除 4 个文件中重复的 AMap 加载逻辑（问题 #55），当前 `initAMap` 是死代码（问题 #32）
- **方式**：
  ```typescript
  let amapPromise: Promise<any> | null = null;
  export function initAMap(plugins: string[] = []) {
    if (amapPromise) return amapPromise;
    if (typeof window !== "undefined") {
      window._AMapSecurityConfig = { securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECRET! };
    }
    amapPromise = import("@amap/amap-jsapi-loader").then((mod) =>
      mod.default.load({ key: process.env.NEXT_PUBLIC_AMAP_KEY!, version: "2.0", plugins })
    ).then((AMap: any) => { AMap.getConfig().appname = "amap-jsapi-skill"; return AMap; });
    return amapPromise;
  }
  ```
- **影响文件**：`MapContainer.tsx`、`MapSettingsPicker.tsx`、`RoutePlan.tsx`、`Topbar.tsx` 改为调用 `initAMap`

#### 1.5 创建 API 请求封装
- **文件**：`/workspace/src/lib/api.ts`（修改）
- **操作**：新增 `apiFetch(path, options?)` 函数，自动校验 `res.ok`，失败抛错
- **原因**：解决 8 处 fetch 未校验 res.ok 问题（#11、#14-#18）
- **方式**：
  ```typescript
  export async function apiFetch(path: string, options?: RequestInit) {
    const res = await fetch(apiUrl(path), options);
    if (!res.ok) {
      let message = `请求失败 (${res.status})`;
      try { const err = await res.json(); message = err.message || message; } catch {}
      throw new Error(message);
    }
    return res.json();
  }
  ```

#### 1.6 创建数据库工具函数
- **文件**：`/workspace/src/lib/db-utils.ts`（新建）
- **操作**：抽取 `parseRow` 函数（解析 JSON 字符串字段）+ `isValidLatLng(household)` + `openNavigation(lng, lat, name)`
- **原因**：消除 5 个 API 路由中重复的 parseRow（#56）、2 处导航逻辑重复（#57）、2 处坐标校验重复（#58）

#### 1.7 创建数据加载 hook
- **文件**：`/workspace/src/lib/hooks/useHouseholds.ts`（新建）
- **操作**：`useHouseholds()` 返回 `{ households, loading, error, reload }`，内置 AbortController
- **原因**：消除 6 个页面重复的 households 加载逻辑（#59），解决 map 页面无取消机制问题（#5）

---

### 阶段 2：鉴权系统完整实现

#### 2.1 创建鉴权工具
- **文件**：`/workspace/src/lib/auth.ts`（新建）
- **内容**：
  - `signToken(user)`: 用 `jsonwebtoken` 签发 7 天过期 token，密钥从 `process.env.JWT_SECRET` 读取
  - `verifyToken(token)`: 验证并返回 payload，失败返回 null
  - `hashPassword(pwd)`: 用 `bcryptjs` hash（saltRounds=10）
  - `comparePassword(pwd, hash)`: bcrypt compare
  - `getAuthUser(request)`: 从 Authorization header 提取并验证 token，返回 user 或 null
- **环境变量**：`/workspace/.env.local` 新增 `JWT_SECRET`（随机 32 字节）
- **原因**：解决问题 #44（token 无签名）、#63（硬编码密码）

#### 2.2 创建用户种子脚本
- **文件**：`/workspace/scripts/seed-admin.ts`（新建）
- **操作**：用 bcryptjs 哈希默认密码，upsert admin 用户到 users 表
- **原因**：users 表已存在 schema 但无数据，需要初始化管理员账号
- **方式**：`npx tsx scripts/seed-admin.ts`（或用 ts-node）。密码从 `process.env.ADMIN_PASSWORD` 读取，默认 `admin123` 仅开发环境

#### 2.3 重写登录 API
- **文件**：`/workspace/src/app/api/auth/route.ts`（修改）
- **操作**：
  - 删除未使用的 `db`、`users`、`eq` 导入（问题 #61）—— 实际上这次要用上它们了
  - POST：从 users 表查询用户，`comparePassword` 校验，成功则 `signToken` 返回
  - 移除硬编码 `admin/admin123` 判断
- **原因**：实现真实鉴权

#### 2.4 添加 API 中间件
- **文件**：`/workspace/src/middleware.ts`（新建）
- **操作**：拦截 `/api/households`、`/api/members`、`/api/visits`、`/api/upload` 的 POST/PUT/DELETE 请求，校验 Authorization header 中的 JWT，无效返回 401
- **放行**：GET 请求、`/api/auth`、`/api/health`、静态资源、`/login`
- **原因**：API 路由当前完全不校验 token（问题 #45）

#### 2.5 移除登录页演示提示
- **文件**：`/workspace/src/app/login/page.tsx`（修改）
- **操作**：删除 `演示账号：admin / admin123` 公开提示（第 90 行附近）；仅在 `process.env.NODE_ENV === "development"` 时显示
- **原因**：问题 #63

#### 2.6 登录页 fetch 容错
- **文件**：`/workspace/src/app/login/page.tsx`（修改）
- **操作**：`res.json().catch(() => ({}))` 兜底非 JSON 响应（问题 #18）

---

### 阶段 3：API 路由健壮性修复

#### 3.1 移除 demo 数据兜底
- **文件**：`/workspace/src/app/api/households/route.ts`
- **操作**：GET 接口 DB 异常时返回 500 + 错误信息，不再返回 `demoHouseholds`（问题 #38）；使用 `parseRow` from db-utils（问题 #56）
- **原因**：避免掩盖真实故障

#### 3.2 修复 PUT 更新逻辑
- **文件**：`/workspace/src/app/api/households/[id]/route.ts`
- **操作**：
  - `memberCount` 更新条件改为 `body.memberCount != null`（问题 #39，避免 0 不更新）
  - `headName` 更新条件改为 `body.headName !== undefined`
  - `householdName` 更新条件改为 `body.householdName !== undefined`（问题 #40，独立于 headName）
  - 使用 `parseRow` from db-utils
- **原因**：falsy 值短路导致更新失败

#### 3.3 修复 members PUT 逻辑
- **文件**：`/workspace/src/app/api/members/[id]/route.ts`
- **操作**：`age` 更新支持清空为 null（问题 #41）；使用 `parseRow`
- **方式**：`...("age" in body) && { age: body.age === null ? null : Number(body.age) }`

#### 3.4 修复 upload 路由
- **文件**：`/workspace/src/app/api/upload/route.ts`
- **操作**：
  - 文件名用 `crypto.randomUUID()` 替代 random（问题 #43）
  - 循环中收集失败文件，最终返回 `{ urls, failures }`（问题 #42）
  - 大小限制引用 `MAX_UPLOAD_SIZE` 常量
- **原因**：部分失败丢失结果、文件名碰撞风险

#### 3.5 其他 API 路由使用 parseRow
- **文件**：`/workspace/src/app/api/members/route.ts`、`/workspace/src/app/api/visits/route.ts`
- **操作**：删除本地 `parseRow`，改为 `import { parseRow } from "@/lib/db-utils"`（问题 #56）

#### 3.6 扩展健康检查
- **文件**：/workspace/src/app/api/health/route.ts`
- **操作**：检查 households/members/visits/users 四张表（问题 #37）

---

### 阶段 4：客户端数据加载健壮性

#### 4.1 map 页面
- **文件**：`/workspace/src/app/(dashboard)/map/page.tsx`
- **操作**：
  - 用 `useHouseholds()` 替换手动 fetch（问题 #5、#59）
  - 走访数据加载加 `cancelled` 标志
  - catch 中 `toast("加载数据失败", "error")`（问题 #6）
  - 保存走访后刷新用 `apiFetch` 替换裸 fetch（问题 #11）
  - `filtered` filter 前加 `h && typeof h.headName === "string"` 守卫（问题 #25）
  - `new Date(b.createdAt || b.visitDate)` 加 `isValidDate` 守卫（问题 #26）
  - `window.speechSynthesis` 加 `"speechSynthesis" in window` 检查（问题 #73）
  - 走访阈值用 `VISIT_ARRIVE_THRESHOLD` 常量（问题 #67）

#### 4.2 people 页面
- **文件**：`/workspace/src/app/(dashboard)/people/page.tsx`
- **操作**：
  - 用 `apiFetch` 替换裸 fetch（问题 #14）
  - `confirm()` 替换为 Modal 确认弹窗（问题 #3）
  - hover 效果改用 CSS class（问题 #47、#48）
  - 坐标校验用 `isValidLatLng`（问题 #58）

#### 4.3 visits 页面
- **文件**：`/workspace/src/app/(dashboard)/visits/page.tsx`
- **操作**：
  - 用 `apiFetch` 替换裸 fetch（问题 #15）
  - hover 效果改用 CSS class（问题 #49）

#### 4.4 statistics 页面
- **文件**：`/workspace/src/app/(dashboard)/statistics/page.tsx`
- **操作**：
  - 用 `apiFetch` 替换裸 fetch（问题 #16）
  - `Promise.all` 改为分别 try/catch（问题 #10）
  - `GROUP_NAMES` 用常量（问题 #65）
  - 颜色用 `COLORS`（问题 #70）

#### 4.5 transfer 页面
- **文件**：`/workspace/src/app/(dashboard)/transfer/page.tsx`
- **操作**：
  - 用 `apiFetch` 替换裸 fetch（问题 #13、#17）
  - 导入后刷新列表校验 res.ok

#### 4.6 household/[id] 页面
- **文件**：`/workspace/src/app/(dashboard)/household/[id]/page.tsx`
- **操作**：
  - 用 `apiFetch` 替换裸 fetch（问题 #12）
  - `fetchData` 中校验 `mRes.ok`、`vRes.ok`（问题 #8）
  - `onSuccess` 回调 catch 中 toast（问题 #9）
  - `tags`/`concerns` 访问加 `Array.isArray` 守卫（问题 #27、#28）
  - `window.history.replaceState` 改用 `router.replace()`（问题 #50）
  - 导航逻辑用 `openNavigation`（问题 #57）
  - 坐标校验用 `isValidLatLng`（问题 #58）
  - 颜色用 `COLORS`（问题 #70）

---

### 阶段 5：React 反模式与监听泄漏修复

#### 5.1 MapContainer 监听泄漏
- **文件**：`/workspace/src/components/map/MapContainer.tsx`
- **操作**：
  - cleanup 中 `window.removeEventListener("deviceorientation", handleOrientation)`（问题 #19，P0）
  - cleanup 中 `geolocation.off("complete", handler)`、`geolocation.off("error", handler)`（问题 #20）
  - `document.querySelector(".loc-marker")` 改用 ref 引用 marker DOM（问题 #46）
  - 定位间隔用 `GEOLOCATION_INTERVAL` 常量（问题 #68）
  - ref 同步赋值改为 useEffect（问题 #54）—— 评估后保留（React 18+ ref 写入幂等，改动收益低风险高，标记为可接受）
  - `(window as any).__navSteps` 改用 CustomEvent detail 传递（问题 #72）
  - 为 AMap 定义最小类型接口减少 any（问题 #71）—— 定义 `AMapInstance`、`AMapMarker`、`AMapMap` 接口

#### 5.2 RoutePlan 异步取消
- **文件**：`/workspace/src/components/map/RoutePlan.tsx`
- **操作**：
  - useEffect 加 `let cancelled = false;` 标志，所有 setState 前判断（问题 #21）
  - AMap 加载改用 `initAMap`（问题 #55）
  - 默认位置用 `DEFAULT_CENTER`（问题 #64）

#### 5.3 MapSettingsPicker 异步取消
- **文件**：`/workspace/src/components/map/MapSettingsPicker.tsx`
- **操作**：
  - `handleLocate` 加 `cancelled` 标志（问题 #22）
  - AMap 加载改用 `initAMap`（问题 #55）

#### 5.4 Topbar AutoComplete 竞态
- **文件**：`/workspace/src/components/layout/Topbar.tsx`
- **操作**：
  - 加 `let requestId = 0;` 序号，每次搜索 `const myId = ++requestId;`，回调中 `if (myId !== requestId) return;`（问题 #23）
  - 加 `mounted` 标志防止卸载后 setState
  - AMap 加载改用 `initAMap(["AMap.AutoComplete"])`（问题 #55）

#### 5.5 Toast counter 修复
- **文件**：`/workspace/src/components/ui/Toast.tsx`
- **操作**：`let counter = 0;` 改为 `const counterRef = useRef(0);`（问题 #24）

#### 5.6 HouseholdForm 输入守卫
- **文件**：`/workspace/src/components/household/HouseholdForm.tsx`
- **操作**：`setMemberCount` 加 `isNaN` 守卫或用 `e.target.valueAsNumber`（问题 #76）

---

### 阶段 6：关键 Bug 修复

#### 6.1 编辑保存死循环（P0）
- **文件**：`/workspace/src/app/(dashboard)/household/[id]/page.tsx`
- **操作**：`handleSaveEditHousehold` 成功后立即清除 URL `edit` 参数（问题 #7）
- **方式**：成功后 `const url = new URL(window.location.href); url.searchParams.delete("edit"); router.replace(url.pathname + url.search);`
- **替代方案**：effect 中加 `visitedRef` 防重复打开 —— 采用清除 URL 方案更彻底

#### 6.2 HouseholdForm visitor 默认值
- **文件**：`/workspace/src/components/visit/VisitForm.tsx`
- **操作**：`visitor` 默认值从 `localStorage.getItem("user")` 解析 displayName（问题 #66）
- **方式**：`const [visitor, setVisitor] = useState(() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.displayName || "管理员"; } catch { return "管理员"; } });`

---

### 阶段 7：代码质量清理

#### 7.1 删除未使用代码
- **文件与操作**：
  - `/workspace/src/lib/utils.ts`：删除未使用的 `cn()` 函数（问题 #33）
  - `/workspace/src/components/ui/SearchInput.tsx`：删除整个文件（问题 #34）
  - `/workspace/src/components/ui/Modal.tsx`：删除整个文件（问题 #35）—— 先确认无引用（Grep 已确认）
  - `/workspace/src/components/layout/Sidebar.tsx`：删除未使用的 `Bell`、`Download` 导入（问题 #60）

#### 7.2 移除多余 "use client"
- **文件与操作**（问题 #51、#52、#53）：
  - `/workspace/src/components/ui/TagBadge.tsx`：移除 `"use client"`（无客户端 hook）
  - 注：`Modal.tsx`、`SearchInput.tsx` 将被删除，无需处理
  - **注意**：删除前需确认这些组件未被客户端组件导入，否则会报错。实际上 TagBadge 若被客户端组件使用，保留 "use client" 也无害。**决策：保留不动**，避免引入风险。

#### 7.3 类型完善
- **文件**：`/workspace/src/types/index.ts`
- **操作**（问题 #29、#30、#31）：
  - `Household.tags`: `string[]` → `Tag[]`
  - `Household` 新增 `createdAt?: string`
  - `Member` 新增 `createdAt?: string`

#### 7.4 global.d.ts 补充
- **文件**：`/workspace/src/types/global.d.ts`
- **操作**：补充 `JWT_SECRET` 等环境变量声明（如有需要）

---

### 阶段 8：Sidebar 占位按钮处理

#### 8.1 村庄切换按钮
- **文件**：`/workspace/src/components/layout/Sidebar.tsx`
- **操作**：`village-switch` 按钮添加 `disabled` 属性 + `title="村庄切换功能开发中"`（问题 #1）
- **原因**：当前无村庄切换功能，避免用户困惑

#### 8.2 通知按钮
- **文件**：`/workspace/src/components/layout/Topbar.tsx`
- **操作**：通知按钮添加 `disabled` + `title="通知功能开发中"`（问题 #2）

---

## Assumptions & Decisions

### 关键决策
1. **鉴权依赖选择**：使用 `bcryptjs`（纯 JS）而非 `bcrypt`（原生编译），避免 better-sqlite3 之外的第二个原生依赖，降低部署复杂度
2. **JWT 密钥**：从 `process.env.JWT_SECRET` 读取，开发环境在 `.env.local` 配置，生产环境通过平台环境变量注入
3. **中间件范围**：仅拦截写操作（POST/PUT/DELETE），GET 请求放行——因为这是内部管理工具，数据不敏感，且避免影响地图页首次加载体验
4. **ref 同步赋值**（问题 #54）：**决策保留不改**，React 18+ ref 写入幂等，改动收益低风险高
5. **"use client" 清理**（问题 #51-#53）：**决策保留不动**，避免引入编译风险
6. **demo 数据兜底**（问题 #38）：完全移除，DB 故障应明确报错而非掩盖
7. **HouseholdForm visitor**（问题 #66）：从 localStorage 读取，fallback "管理员"

### 假设
- `@types/jsonwebtoken` 和 `@types/bcryptjs` 在 npm registry 可用
- 项目使用 npm 而非 yarn/pnpm（基于 package-lock.json 判断）
- `.env.local` 已存在或可创建（含 `NEXT_PUBLIC_AMAP_KEY`、`NEXT_PUBLIC_AMAP_SECRET`）
- 用户接受登录页在开发环境仍显示演示账号提示（仅生产环境移除）

### 不在本次范围
- 单元测试编写（项目当前无测试框架）
- E2E 测试
- 国际化（i18n）
- PWA 离线支持
- 真正的多村庄切换功能实现（仅 disable 按钮）

---

## Verification Steps

### 阶段性验证
1. **阶段 1 完成后**：`npx tsc --noEmit` 无类型错误；`npm run dev` 启动正常
2. **阶段 2 完成后**：
   - 运行 seed 脚本创建 admin 用户
   - 登录页登录成功，返回 JWT token
   - 用错误密码登录失败
   - 不带 token 调用 POST /api/households 返回 401
3. **阶段 3 完成后**：
   - 手动测试 PUT /api/households/[id] 传入 `memberCount: 0` 能正确更新
   - upload 接口部分失败时返回 failures
4. **阶段 4-6 完成后**：
   - 模拟 DB 故障，页面显示 toast 错误而非白屏
   - household 详情页编辑保存后弹窗不再重开
   - 快速切换页面无控制台警告
5. **阶段 7-8 完成后**：`npx tsc --noEmit` 无错误；`npm run lint` 无警告

### 最终验证
```bash
# 1. 类型检查
npx tsc --noEmit

# 2. ESLint
npm run lint

# 3. 构建测试
npm run build

# 4. 启动并手动测试关键流程
npm run dev
# - 登录（正确/错误密码）
# - 新增/编辑/删除住户
# - 地图搜索位置
# - 走访记录
# - 统计页面
# - 批量导入
```

### 回归测试清单
- [ ] 登录流程（admin/admin123 仍可用，因 seed 脚本默认密码）
- [ ] 地图页加载、住户标记、搜索位置、走访模式
- [ ] 住户 CRUD（含 memberCount=1 边界）
- [ ] 成员 CRUD（含 age 清空为 null）
- [ ] 走访记录 CRUD + 图片上传（部分失败场景）
- [ ] 统计页面数据正确
- [ ] 批量导入 CSV
- [ ] 移动端布局（topbar、tab 栏、地图高度）
