# 村智图（VillageMap）产品级升级计划

## 概要

将当前"花园村重点人群管理平台"从后台管理系统风格升级为**地图优先、产品级**的数字化乡村管理平台"村智图"。核心改动：接入高德地图真实 API、重构 UI 为产品级设计、增加登录页、完善数据统计、优化移动端体验。

---

## 当前状态分析

### 已有实现
- **数据库**：PostgreSQL + Drizzle ORM，`households` 和 `visits` 两张表，字段完整
- **API**：`/api/households`（GET/POST）、`/api/visits`（GET/POST）、`/api/health`（GET）
- **前端**：单文件 `page.tsx`（约 360 行 JSX + 360 行 CSS），包含：
  - 侧边栏导航 + 地图首页 + 人员管理 + 走访记录 + 数据统计 + 导入导出 + 系统设置
  - 侧滑 Drawer 展示住户详情
  - 家庭详情页（Tab 切换：基础信息/家庭成员/走访记录/图片）
  - 新增住户 Modal（含 SVG 假地图点击选点）
  - 新增走访 Modal
  - 移动端底部导航 + 响应式布局
- **地图**：目前是 SVG 绘制的假地图（MapTerrain 组件），Marker 用绝对定位
- **配色**：已定义蓝绿配色方案（`--blue:#2f80ed`, `--green:#27ae60` 等）
- **缺失**：无登录页、无真实地图、无图片上传、无 Excel 导入导出、无成员管理 API、统计图仅为 CSS 模拟
- **环境**：`.env.local` 已创建但 AMAP_KEY 为占位值；`npm install` 新依赖未完成（网络问题）

### 高德地图凭证（用户已提供）
- **Key**: `0725c389055177586ede0637887fcde2`
- **安全密钥**: `31b32c8992a245df88ff4a90aba5a1cf`
- **API 版本**: JS API 2.0
- **接入方式**: 使用 AMapLoader + 明文安全密钥（开发阶段，生产环境建议代理转发）

---

## 实施计划

### 阶段 0：环境修复（前置条件）

#### 0.1 更新 .env.local 填入真实 Key
- **文件**：`.env.local`
- **内容**：
  ```
  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
  NEXT_PUBLIC_AMAP_KEY=0725c389055177586ede0637887fcde2
  NEXT_PUBLIC_AMAP_SECRET=31b32c8992a245df88ff4a90aba5a1cf
  ```

#### 0.2 安装新依赖
```bash
npm install @amap/amap-jsapi-loader recharts
```
- `@amap/amap-jsapi-loader`：高德地图 JS API 2.0 加载器
- `recharts`：数据统计图表库（柱状图、饼图、趋势图）

#### 0.3 修复 SWC 加载问题（如仍存在）
```bash
npm install @next/swc-win32-x64-msvc
```

---

### 阶段 1：项目结构重构 + 基础设施

将单文件 `page.tsx` 拆分为组件结构。采用 **渐进式策略**：先创建基础设施文件（types、lib、ui 组件），然后逐页面迁移。

#### 1.1 创建类型定义
- **文件**：`src/types/index.ts`
- 从 `page.tsx` 提取 `Household`、`Visit`、`Tag` 类型
- 新增 `Member` 类型
- 扩展 Tag 联合类型：`"脱贫户" | "监测户" | "独居老人" | "留守儿童" | "精神障碍" | "残疾人" | "五保" | "低保"`

#### 1.2 创建标签配置
- **文件**：`src/lib/tags.ts`
- 导出 `allTags` 数组、`tagColorMap`（标签→颜色映射）、`tagIconMap`（标签→图标映射）
- 配色方案：
  | 类型 | 颜色 | 色值 |
  |------|------|------|
  | 脱贫户 | 绿 | #27AE60 |
  | 监测户 | 黄 | #F2994A |
  | 独居老人 | 蓝 | #2F80ED |
  | 留守儿童 | 橙 | #E67E22 |
  | 精神障碍 | 紫 | #9B86DC |
  | 残疾人 | 灰 | #8E99A4 |
  | 五保 | 红 | #EB5757 |
  | 低保 | 金棕 | #C4960A |

#### 1.3 创建工具函数
- **文件**：`src/lib/utils.ts`
- `maskPhone(phone)`: 电话脱敏
- `cn(...classes)`: CSS 类名合并

#### 1.4 创建高德地图初始化模块
- **文件**：`src/lib/amap.ts`
- 使用 `@amap/amap-jsapi-loader` 封装地图加载逻辑
- 关键代码逻辑：
  ```typescript
  import AMapLoader from '@amap/amap-jsapi-loader';

  export function initAMap() {
    // 设置安全密钥（必须在加载地图之前）
    window._AMapSecurityConfig = {
      securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECRET!,
    };
    return AMapLoader.load({
      key: process.env.NEXT_PUBLIC_AMAP_KEY!,
      version: '2.0',
    });
  }
  ```
- 需要在 `src/types/global.d.ts` 中声明 `window._AMapSecurityConfig` 类型

#### 1.5 创建 UI 基础组件
- **文件**：`src/components/ui/TagBadge.tsx` — 标签徽章（从 page.tsx 提取）
- **文件**：`src/components/ui/SearchInput.tsx` — 搜索输入框
- **文件**：`src/components/ui/Modal.tsx` — 通用弹窗

---

### 阶段 2：数据库 Schema 扩展

**文件**：`src/db/schema.ts`

#### 2.1 新增 members 表
```typescript
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 60 }).notNull(),
  relation: varchar("relation", { length: 20 }).notNull(),
  age: integer("age"),
  gender: varchar("gender", { length: 4 }),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

#### 2.2 新增 users 表
```typescript
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 60 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 200 }).notNull(),
  displayName: varchar("display_name", { length: 60 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("admin"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

---

### 阶段 3：登录页

**文件**：`src/app/login/page.tsx`

- 全屏渐变背景（蓝绿渐变 + CSS 模拟田野/村庄剪影）
- 居中登录卡片：
  - Logo：村智图 VillageMap
  - 副标题：花园村重点人群数字化管理平台
  - 用户名/密码输入 + 登录按钮
- Demo 账号：admin / admin123
- 登录成功后 `localStorage.setItem('token', ...)` + `router.push('/map')`
- API：`POST /api/auth`（新增）

**API 文件**：`src/app/api/auth/route.ts`
- POST：验证用户名密码，返回 token
- Demo 模式：硬编码 admin/admin123

---

### 阶段 4：地图首页（核心，最高优先级）

#### 4.1 应用外壳
**文件**：`src/app/(dashboard)/layout.tsx`
- 使用 Next.js Route Group `(dashboard)` 包含登录后的所有页面
- 布局包含：Sidebar + Topbar + MobileNav
- 未登录重定向到 `/login`

**文件**：`src/components/layout/Sidebar.tsx`
- 从 page.tsx 提取侧边栏代码
- 导航项：地图工作台、人员管理、入户记录、数据统计、导入导出、系统设置

**文件**：`src/components/layout/Topbar.tsx`
- 顶栏：搜索框 + 通知 + 管理员头像

**文件**：`src/components/layout/MobileNav.tsx`
- 移动端底部导航：地图/人员/新增/统计/我的

#### 4.2 地图容器组件
**文件**：`src/app/(dashboard)/map/page.tsx` — 地图首页路由页面

**文件**：`src/components/map/MapContainer.tsx`
- 核心组件：加载高德地图 JS API 2.0
- 初始化流程：
  1. 设置 `window._AMapSecurityConfig.securityJsCode`
  2. 调用 `AMapLoader.load()` 加载 API
  3. 创建 `new AMap.Map(container, { center, zoom, mapStyle })`
- 中心点：`[114.34, 30.52]`（花园村坐标，注意高德格式为 [lng, lat]）
- 缩放级别：14
- 地图样式：`amap://styles/whitesmoke`（清爽白底，适合数据标注）
- 管理 Marker 的添加/删除/更新
- 点击事件：选中住户 → 打开 Drawer

#### 4.3 自定义 Marker
**文件**：`src/components/map/MapMarker.tsx`
- 使用 `AMap.Marker` 的 `content` 属性自定义 DOM
- 每个家庭取第一个标签决定主颜色
- Marker HTML 结构：
  ```html
  <div class="custom-marker">
    <div class="marker-circle" style="background: {主标签颜色}">
      <svg>{图标}</svg>
    </div>
    {多标签 && <div class="marker-badge">{标签数}</div>}
  </div>
  ```
- 样式：圆形 + 白色边框 + 阴影 + 选中时脉冲动画
- 多标签时右上角显示数量角标（小圆圈 + 数字）

#### 4.4 地图工具栏
**文件**：`src/components/map/MapToolbar.tsx`
- 顶部标签筛选栏（水平滚动的 Tag 按钮）
- 搜索框
- 新增住户按钮
- 已定位 X / N 户 计数

#### 4.5 侧滑 Drawer
**文件**：`src/components/map/HouseholdDrawer.tsx`
- 从 page.tsx 提取并改进
- 宽度 420px（当前 380px，需加宽）
- 内容：组别、户名、户主、电话、家庭人数、特殊群体标签、最近走访
- 底部按钮：查看详情 / 新增走访 / 导航 / 编辑
- 导航按钮：`window.open('https://uri.amap.com/navigation?to=${lng},${lat},${name}')`

#### 4.6 新增住户表单
**文件**：`src/components/household/HouseholdForm.tsx`
- 左右布局：左侧表单 + 右侧高德地图选点
- 表单字段：户主姓名、电话、组别、家庭地址、家庭人数
- 特殊标签：Tag 多选按钮（非 Select 下拉），8 个标签一目了然
- 地图点击选点：监听地图 click 事件，获取经纬度，放置临时 Marker
- 保存：POST /api/households

---

### 阶段 5：家庭详情页

**文件**：`src/app/(dashboard)/household/[id]/page.tsx`

- 顶部：← 返回地图 + 导航按钮 + 新增走访按钮
- Hero 区域：户名、组别、地址、标签徽章
- Tab 切换：基础信息 / 家庭成员 / 走访记录 / 图片

**子组件**：
- `src/components/household/MemberCard.tsx` — 人物卡片（姓名/年龄/性别/标签）
- `src/components/visit/VisitTimeline.tsx` — 走访时间线
- `src/components/household/PhotoGrid.tsx` — 九宫格图片

---

### 阶段 6：新增走访

**文件**：`src/components/visit/VisitForm.tsx`

- 走访日期（date input）
- 走访人员
- 走访内容（textarea）
- 关注事项：住房/收入/教育/医疗 Tag 切换
- 图片上传区（拖拽支持，MVP 阶段前端 UI 就绪）
- 保存按钮 → POST /api/visits

---

### 阶段 7：数据统计

**文件**：`src/app/(dashboard)/statistics/page.tsx`

**子组件**：
- `src/components/statistics/StatCards.tsx` — 顶部数字卡片（重点户/脱贫户/监测户/老人）
- `src/components/statistics/GroupBarChart.tsx` — Recharts BarChart，X 轴各组
- `src/components/statistics/TypePieChart.tsx` — Recharts PieChart，群体占比
- `src/components/statistics/TrendChart.tsx` — Recharts LineChart，走访趋势

---

### 阶段 8：API 补充

#### 8.1 `src/app/api/households/[id]/route.ts`
- `GET`：获取单个住户详情（含成员列表）
- `PUT`：编辑住户信息
- `DELETE`：删除住户

#### 8.2 `src/app/api/members/route.ts`
- `GET`：`?householdId=X` 查询成员
- `POST`：新增成员

#### 8.3 `src/app/api/members/[id]/route.ts`
- `PUT`：编辑成员
- `DELETE`：删除成员

---

### 阶段 9：其余页面 + 移动端优化

- `src/app/(dashboard)/people/page.tsx` — 人员列表页
- `src/app/(dashboard)/visits/page.tsx` — 走访记录页
- `src/app/(dashboard)/transfer/page.tsx` — 导入导出页
- `src/app/(dashboard)/settings/page.tsx` — 系统设置页
- 移动端：底部导航 + Drawer 改底部上滑 + 全屏表单

---

### 阶段 10：404 页面

**文件**：`src/app/not-found.tsx`
- 简洁 404 + 返回首页按钮

---

## 关键技术决策

1. **高德地图接入方式**：使用 `@amap/amap-jsapi-loader` + 明文 `securityJsCode`（开发阶段便捷）
2. **Route Group**：使用 `(dashboard)` route group 共享登录后布局
3. **状态管理**：React Context + useState，不引入 Redux
4. **CSS**：保留当前 globals.css + Tailwind CSS 方案，不引入 UI 组件库
5. **登录**：Demo 级别 admin/admin123，前端 localStorage 存 token
6. **图片上传**：前端 UI 就绪，MVP 阶段存储为占位
7. **数据库**：继续 PostgreSQL + Drizzle ORM

---

## 验证步骤

1. 项目能正常 `npm run dev` 启动
2. 访问 `/login` 可用 admin/admin123 登录
3. 登录后跳转地图首页，高德地图正常加载显示花园村
4. 地图上显示自定义颜色 Marker，颜色对应标签类型
5. 点击 Marker 弹出侧滑 Drawer，显示住户详情
6. 可新增住户（地图选点 + 表单），保存后 Marker 出现在地图上
7. 可查看家庭详情（Tab 切换正常）
8. 可新增走访记录
9. 数据统计页面 Recharts 图表正常渲染
10. 移动端底部导航 + 响应式正常
