# 村智图（VillageMap）项目完成进度审查与问题修复计划

## 概要

基于对项目全部源代码的逐文件审查（含 18 个源文件 + 6 个 API 路由 + DB Schema + 配置），评估当前完成进度，列出**未实现/未生效的交互元素**与**存在的问题**，并制定修复计划。

---

## 一、当前完成进度评估

### 已完成（约 85%）

| 模块 | 状态 | 说明 |
|------|------|------|
| 高德地图接入 | ✅ | 真实 JSAPI 2.0，含安全密钥、Scale、ControlBar、Geolocation、Geocoder、Driving/Walking/Riding 插件 |
| 地图首页 | ✅ | 自定义 Marker（图片+标签角标+选中脉冲）、卫星/标准切换、定位按钮、选点逆地理编码 |
| 路线规划 | ✅ | 起点/终点/途经点、三种出行方式、语音播报、导航步骤面板、走访模式（到达自动弹窗） |
| 新增住户 | ✅ | 表单 + 地图选点 + 自动逆地理编码填充地址 + 重复校验 |
| 新增走访 | ✅ | 表单 + 图片上传（真实上传到 `/api/upload`，支持拖拽） |
| 人员管理页 | ✅ | 卡片网格、搜索、标签筛选、编辑（弹窗）、删除 |
| 入户记录页 | ✅ | 按日期分组折叠、本月/累计统计、关注点+图片数展示 |
| 数据统计页 | ✅ | 4 卡片 + 柱状图 + 饼图（conic-gradient）+ 趋势图 |
| 导入导出页 | 🟡 部分 | 导出 CSV ✅；导入仅显示文件名，未实际解析/导入 |
| 系统设置页 | ✅ | 账户信息、地图设置、关于系统（只读展示） |
| 家庭详情页 | ✅ | 4 Tab 切换、添加成员 Modal、走访时间线 |
| 登录页 | ✅ | admin/admin123，localStorage 存 token |
| 路由守卫 | ✅ | dashboard layout 检查 token，未登录跳 /login |
| 退出登录 | ✅ | Topbar 用户头像处 |
| 404 页面 | ✅ | 简洁 404 + 返回首页 |
| API | ✅ | households/visits/members/upload/auth/health 全部实现 |
| DB Schema | ✅ | households/visits/members/users 四表，含级联删除 |

---

## 二、未实现/未生效的交互元素

### P0 - 严重（交互完全无效）

#### 1. Drawer "编辑"按钮失效
- **文件**：[HouseholdDrawer.tsx](file:///workspace/src/components/map/HouseholdDrawer.tsx) 第 90 行
- **问题**：链接到 `/household/${id}?edit=1`，但 [household/[id]/page.tsx](file:///workspace/src/app/(dashboard)/household/[id]/page.tsx) 未读取 `?edit=1` 参数，点击后只显示普通详情页，不进入编辑模式
- **影响**：地图页 Drawer 中的"编辑"按钮完全无功能
- **注**：人员管理页的编辑弹窗是独立实现，正常工作

#### 2. Toast 组件已创建但从未被调用
- **文件**：[Toast.tsx](file:///workspace/src/components/ui/Toast.tsx)、[layout.tsx](file:///workspace/src/app/layout.tsx)
- **问题**：`ToastProvider` 已在根 layout 挂载，但 `useToast()` 全局仅 1 处定义、**0 处调用**。所有错误提示仍用 `alert()`
- **alert 调用点（9 处）**：
  - [map/page.tsx](file:///workspace/src/app/(dashboard)/map/page.tsx) 第 144、147、151 行
  - [people/page.tsx](file:///workspace/src/app/(dashboard)/people/page.tsx) 第 49、53、92、96 行
  - [household/[id]/page.tsx](file:///workspace/src/app/(dashboard)/household/[id]/page.tsx) 第 549、571 行
- **影响**：用户体验差，alert 阻塞、不美观

### P1 - 中等（功能不完整）

#### 3. 家庭详情页"图片"Tab 为静态占位
- **文件**：[household/[id]/page.tsx](file:///workspace/src/app/(dashboard)/household/[id]/page.tsx) 第 444-470 行
- **问题**：固定渲染 6 个灰色方块显示"暂无图片"，未读取 `visits` 中的 `images` 字段聚合展示
- **影响**：走访时上传的图片在详情页看不到
- **数据**：`visits` 表有 `images` 字段（JSON 数组），VisitForm 已真实上传，数据可用

#### 4. 导入功能未实现
- **文件**：[transfer/page.tsx](file:///workspace/src/app/(dashboard)/transfer/page.tsx) 第 215-219 行
- **问题**：`onChange` 仅 `setSelectedFile(file.name)`，无文件解析、无预览、无 API 调用
- **影响**：导入按钮实际只展示文件名，不能批量导入

#### 5. 成员管理无编辑/删除
- **文件**：[household/[id]/page.tsx](file:///workspace/src/app/(dashboard)/household/[id]/page.tsx) 第 252-314 行
- **问题**：成员卡片只有展示，无编辑/删除按钮；API 也缺少 `PUT/DELETE /api/members/[id]`
- **影响**：添加错误的成员无法修正/删除

#### 6. 统计趋势图使用随机假数据
- **文件**：[statistics/page.tsx](file:///workspace/src/app/(dashboard)/statistics/page.tsx) 第 91-95 行
- **问题**：`if (!hasVisitData) { months.forEach((m) => { m.count = Math.floor(Math.random() * 8) + 2; }); }` 没有走访数据时显示随机数
- **影响**：数据失真，误导决策
- **次生问题**：趋势统计基于 `households.lastVisitAt`（每户只算 1 次），而非 `visits` 表实际走访记录，同月多次走访会被低估

#### 7. Drawer 导航按钮未校验坐标
- **文件**：[map/page.tsx](file:///workspace/src/app/(dashboard)/map/page.tsx) 第 173-181 行 `handleNavigate`
- **问题**：经纬度为 0 或 NaN 时仍打开 `uri.amap.com/navigation?to=0,0,...`，导航到海里
- **影响**：旧数据或未选点的住户点击导航会出错

### P2 - 轻微（体验/一致性）

#### 8. 大量页面使用内联 style 而非 CSS 类
- **文件**：
  - [statistics/page.tsx](file:///workspace/src/app/(dashboard)/statistics/page.tsx)（约 380 行内联）
  - [household/[id]/page.tsx](file:///workspace/src/app/(dashboard)/household/[id]/page.tsx)（约 500 行内联）
  - [people/page.tsx](file:///workspace/src/app/(dashboard)/people/page.tsx)
  - [visits/page.tsx](file:///workspace/src/app/(dashboard)/visits/page.tsx)
  - [transfer/page.tsx](file:///workspace/src/app/(dashboard)/transfer/page.tsx)
  - [settings/page.tsx](file:///workspace/src/app/(dashboard)/settings/page.tsx)
- **问题**：与 globals.css 类名方案不一致，难维护
- **注**：fix plan 第 11、12 项提到过，未执行

#### 9. 入户记录列表无图片缩略图预览
- **文件**：[visits/page.tsx](file:///workspace/src/app/(dashboard)/visits/page.tsx) 第 366-384 行
- **问题**：只显示"N张图"徽章，无缩略图
- **影响**：走访记录的图片证据不可直览

#### 10. members 表无 demo 数据
- **文件**：[api/households/route.ts](file:///workspace/src/app/api/households/route.ts)
- **问题**：households 有 5 条 demo 数据，但 members 表始终为空，家庭详情页"家庭成员"Tab 永远显示"暂无成员信息"
- **影响**：演示效果不完整

#### 11. MobileNav "新增"按钮在已处于 /map 时不触发
- **文件**：[MobileNav.tsx](file:///workspace/src/components/layout/MobileNav.tsx) 第 11 行
- **问题**：链接 `/map?add=1`，若当前已在 /map，Next.js 同路径不导航，`useSearchParams` 不变，`useEffect` 不触发
- **影响**：移动端在地图页点底部"新增"可能无反应

#### 12. RoutePlan 中 `(window as any).__deviceHeading` 未被使用
- **文件**：[RoutePlan.tsx](file:///workspace/src/components/map/RoutePlan.tsx) 第 78-85 行
- **问题**：监听设备朝向写入 `window.__deviceHeading`，但无任何地方读取该值
- **影响**：死代码，无实际功能

#### 13. 路线取消时未清理语音合成队列（部分）
- **文件**：[map/page.tsx](file:///workspace/src/app/(dashboard)/map/page.tsx) 第 269-271 行
- **问题**：取消路线时调用了 `speechSynthesis.cancel()`（已修复），但走访模式 `visitMode` 关闭后，正在进行的 `setInterval` 定位检测需要确认停止——已通过 `useEffect` 清理，OK
- **状态**：基本正常，仅记录

---

## 三、其他确认正常的点

- ✅ globals.css 中旧的 SVG 地图样式（`.map-canvas`/`.terrain`/`.map-marker`/`.marker-pin`）**已清理**（fix plan 第 15 项已完成）
- ✅ 统计页**已不再**硬编码 `householdId=1`（fix plan 第 10 项已修复，现取全量 households）
- ✅ `.env.local` 已填入真实 AMAP_KEY 与 SECRET
- ✅ `package.json` 已安装 `@amap/amap-jsapi-loader`、`recharts`、`better-sqlite3`、`lucide-react`
- ✅ DB 实际使用 SQLite（better-sqlite3），schema 用 `sqliteTable`，非 PostgreSQL（与 upgrade plan 描述不符但功能正常）
- ✅ `appname = 'amap-jsapi-skill'` 埋点已设置（MapContainer 第 114 行、RoutePlan 第 39 行）
- ✅ 安全密钥配置正确（`window._AMapSecurityConfig.securityJsCode`）

---

## 四、修复计划

### 阶段 1：P0 严重问题（最高优先）

#### 1.1 修复 Drawer "编辑"按钮
- **文件**：`src/app/(dashboard)/household/[id]/page.tsx`
- **方案**：读取 `?edit=1` searchParams，若为编辑模式则直接打开 `HouseholdForm`（initialData=当前 household），保存后 PUT `/api/households/[id]` 并刷新页面数据
- **依赖**：`HouseholdForm` 已支持 `initialData`（People 页已验证可用）

#### 1.2 替换所有 alert() 为 toast
- **文件**：map/page.tsx、people/page.tsx、household/[id]/page.tsx
- **方案**：在各组件调用 `useToast()`，将 9 处 `alert()` 替换为 `toast(msg, "error")`；成功操作补充 `toast(msg, "success")`
- **同步**：VisitForm、HouseholdForm 保存成功/失败也接入 toast（目前 VisitForm 保存后无任何反馈）

### 阶段 2：P1 功能补全

#### 2.1 家庭详情页图片 Tab 真实展示
- **文件**：`src/app/(dashboard)/household/[id]/page.tsx`
- **方案**：从已加载的 `visits` 数组聚合所有 `images`，按走访时间倒序展示为九宫格缩略图；点击放大预览（简易 lightbox）
- **数据**：`visits[].images` 已是 `/uploads/xxx.jpg` 路径数组，用 `assetUrl()` 拼接

#### 2.2 导入住户功能
- **文件**：`src/app/(dashboard)/transfer/page.tsx`
- **方案**：
  1. 选择 CSV 后用 `FileReader` 读取并解析（复用导出时的表头约定）
  2. 显示预览表格（前 5 行）
  3. 确认按钮循环 POST `/api/households`（已支持重复校验返回 409）
  4. 显示导入结果（成功 N 条、跳过 M 条）

#### 2.3 成员编辑/删除
- **新增 API**：`src/app/api/members/[id]/route.ts`（PUT/DELETE）
- **文件**：`src/app/(dashboard)/household/[id]/page.tsx`
- **方案**：成员卡片增加编辑/删除按钮（hover 显示），编辑复用 AddMemberModal 结构（改为受控 initialData）

#### 2.4 统计趋势图改用真实走访数据
- **文件**：`src/app/(dashboard)/statistics/page.tsx`
- **方案**：
  1. `fetch("/api/visits")` 获取全量走访记录
  2. 按 `visitDate` 月份聚合统计走访次数（同月多次走访累计）
  3. 删除随机假数据 fallback，无数据时显示空状态提示

#### 2.5 Drawer 导航按钮坐标校验
- **文件**：`src/app/(dashboard)/map/page.tsx` `handleNavigate`
- **方案**：校验 `lng/lat` 为有效数字且不为 0，否则 `toast("该住户未设置位置信息", "error")`

### 阶段 3：P2 体验优化（可选）

#### 3.1 members 表 demo 数据
- **文件**：`src/app/api/members/route.ts` GET
- **方案**：GET 时若该 householdId 无成员，插入 1-2 条 demo 成员（如户主本人+配偶）

#### 3.2 入户记录图片缩略图
- **文件**：`src/app/(dashboard)/visits/page.tsx`
- **方案**：走访项下方展示前 3 张缩略图 + "共 N 张"角标

#### 3.3 MobileNav 新增按钮修复
- **文件**：`src/components/layout/MobileNav.tsx`
- **方案**：改为 `onClick` 调 `router.push("/map?add=1&_t=" + Date.now())` 加时间戳强制刷新，或改用全局事件触发 MapPage 打开新增弹窗

#### 3.4 清理 RoutePlan 死代码
- **文件**：`src/components/map/RoutePlan.tsx` 第 78-85 行
- **方案**：删除 `__deviceHeading` 相关监听（无消费方）

#### 3.5 内联 style 迁移到 globals.css（大工程，可分批）
- **方案**：按页面逐步迁移，优先 statistics 与 household/[id]（fix plan 第 11、12 项遗留）

---

## 五、实施优先级

1. **阶段 1**（P0）：Drawer 编辑按钮 + alert→toast ← 立即修复
2. **阶段 2.1-2.5**（P1）：图片 Tab + 导入 + 成员管理 + 统计修正 + 导航校验
3. **阶段 3**（P2）：demo 数据 + 缩略图 + MobileNav + 死代码清理
4. **阶段 3.5**（P2）：内联 style 迁移（最后做，纯重构无功能影响）

---

## 六、验证步骤

1. 地图页 Drawer 点"编辑"→ 进入家庭详情页编辑模式 → 修改保存 → 数据更新
2. 任意保存失败/重复操作 → 右上角 toast 提示（非 alert 阻塞）
3. 家庭详情页"图片"Tab → 展示该户所有走访图片缩略图 → 点击放大
4. 导入页选 CSV → 预览 → 确认导入 → 列表新增
5. 家庭详情页成员卡片 → 编辑/删除按钮可用
6. 统计页趋势图 → 数据为真实走访次数，无随机数
7. 经纬度为 0 的住户点导航 → toast 提示而非打开错误 URL
8. members 表有 demo 数据，详情页"家庭成员"Tab 非空
9. 移动端地图页点底部"新增" → 弹窗正常打开

---

## 七、假设与决策

1. **不动 DB 引擎**：当前 SQLite 工作正常，不迁移到 PostgreSQL（与 upgrade plan 描述不符但无功能影响）
2. **不引入新 UI 库**：继续用 globals.css + 内联 style 混用，仅迁移高频页面
3. **图片预览用原生 lightbox**：不引入第三方图片预览库，用 CSS + state 实现简易版
4. **CSV 导入仅支持与导出同格式**：不处理 Excel .xlsx，保持轻量
5. **编辑模式实现方式**：在详情页内联打开 HouseholdForm（与 People 页一致），不单独做编辑路由
