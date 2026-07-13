# 村智图（VillageMap）项目问题修复与功能补全计划

## 概要

基于对项目全部源代码的逐文件审查，列出当前存在的问题、未实现功能、以及交互组件缺失，并制定修复计划。

---

## 问题清单

### P0 - 严重问题（影响核心功能）

1. **高德地图 INVALID_USER_DOMAIN**
   - 原因：Key 域名白名单未包含当前访问域名
   - 状态：用户已在高德控制台清空白名单，但可能仍需确认生效

2. **登录无路由守卫**
   - 文件：`src/app/(dashboard)/layout.tsx`
   - 问题：未登录用户可以直接访问 `/map` 等页面，无重定向到登录页
   - 需要：在 dashboard layout 中检查 localStorage token，未登录则 redirect 到 `/login`

3. **Topbar 搜索框无功能**
   - 文件：`src/components/layout/Topbar.tsx`
   - 问题：搜索框是静态 HTML，没有与任何状态联动
   - 需要：Topbar 搜索应与地图页搜索联动，或至少在地图页外作为独立搜索

4. **新增住户 POST 在数据库不可用时静默失败**
   - 文件：`src/app/api/households/route.ts` POST 方法
   - 问题：try/catch 返回 500 错误，前端没有 toast/提示
   - 需要：前端添加保存失败提示

### P1 - 中等问题（影响用户体验）

5. **4 个页面为占位符**
   - `src/app/(dashboard)/people/page.tsx` - 人员管理：仅"开发中..."
   - `src/app/(dashboard)/visits/page.tsx` - 入户记录：仅"开发中..."
   - `src/app/(dashboard)/transfer/page.tsx` - 导入导出：仅"开发中..."
   - `src/app/(dashboard)/settings/page.tsx` - 系统设置：仅"开发中..."
   - 这些页面应有实际功能

6. **家庭详情页"添加成员"按钮无功能**
   - 文件：`src/app/(dashboard)/household/[id]/page.tsx` 第 211-228 行
   - 问题：点击"添加成员"按钮无任何响应
   - 需要：弹出成员表单 Modal，提交到 `/api/members`

7. **图片 Tab 为静态占位**
   - 文件：`src/app/(dashboard)/household/[id]/page.tsx` 第 439-465 行
   - 问题：6 个灰色方块，无上传和预览功能
   - 需要：图片上传 UI + 预览功能（MVP 可用前端占位）

8. **VisitForm 图片上传为占位**
   - 文件：`src/components/visit/VisitForm.tsx` 第 112-119 行
   - 问题：`.upload-area` 是纯 UI，没有实际拖拽和文件选择逻辑
   - 需要：添加 `<input type="file">` 和拖拽事件处理

9. **导航按钮（Drawer 中）未验证**
   - 文件：`src/components/map/HouseholdDrawer.tsx`
   - 问题：导航按钮使用 `uri.amap.com` 方案，但经纬度为 0 或未验证
   - 需要：对经纬度为 0 的情况给出提示

10. **统计数据只取 householdId=1 的走访**
    - 文件：`src/app/(dashboard)/statistics/page.tsx` 第 23 行
    - 问题：`fetch("/api/visits?householdId=1")` 硬编码只取 ID=1 的走访
    - 需要：应获取所有走访记录用于统计，或新增一个统计 API

11. **统计页面使用内联 style 而非 CSS 类**
    - 问题：整个 statistics 页面约 380 行全是内联 style
    - 需要：迁移到 globals.css 类名，与其他页面保持一致

12. **家庭详情页使用内联 style**
    - 问题：household/[id]/page.tsx 约 500 行全是内联 style
    - 需要：迁移到 globals.css 类名

### P2 - 轻微问题（不影响功能但应优化）

13. **退出登录无入口**
    - 侧边栏和顶栏都没有退出登录按钮
    - 需要：在顶栏用户头像处添加退出登录

14. **数据库 members 表无 demo 数据种子**
    - 问题：即使数据库可用，members 表始终为空
    - 需要：在 households API 中添加 members demo 数据

15. **globals.css 中旧样式残留**
    - 问题：部分旧的 SVG 地图样式（如 `.map-canvas`、`.terrain`、`.map-marker`、`.marker-pin` 等）仍存在于 CSS 中
    - 需要：清理不再使用的 CSS 规则

16. **编辑住户功能未实现**
    - 问题：Drawer 中"编辑"按钮链接到 `?edit=1`，但详情页没有读取此参数
    - 需要：在详情页添加编辑模式

17. **新增住户表单中组别名称匹配问题**
    - 文件：`src/components/household/HouseholdForm.tsx`
    - 问题：组名使用中文（"第一组"），但 API demo 数据使用 "第五组" 等不同格式
    - 需要确认：组名格式是否统一

18. **MobileNav "新增"按钮应打开新增住户**
    - 问题：链接到 `/map?add=1`，但地图页的 Suspense 包裹可能导致 searchParams 读取时机问题

---

## 实施计划

### 阶段 1：核心功能修复

#### 1.1 登录路由守卫
- **文件**：`src/app/(dashboard)/layout.tsx`
- 改为客户端组件，检查 `localStorage.getItem('token')`
- 未登录时 `router.push('/login')`
- 添加 loading 状态避免闪烁

#### 1.2 退出登录
- **文件**：`src/components/layout/Topbar.tsx`
- 在用户头像旁添加下拉菜单或直接退出按钮
- 清除 localStorage token + redirect 到 `/login`

#### 1.3 前端操作反馈
- 创建 `src/components/ui/Toast.tsx` — 全局 toast 提示组件
- 在 MapPage 中的 `handleSaveHousehold` 和 `handleSaveVisit` 添加成功/失败提示

### 阶段 2：人员管理页面

- **文件**：`src/app/(dashboard)/people/page.tsx`
- 从 `/api/households` 获取数据
- 以卡片网格展示所有住户（复用旧 page.tsx 中的 family-card 样式）
- 支持搜索和标签筛选
- 点击卡片跳转到 `/household/[id]`

### 阶段 3：入户记录页面

- **文件**：`src/app/(dashboard)/visits/page.tsx`
- 从 `/api/visits` 获取数据（需新增不按 householdId 过滤的 API）
- 左侧统计摘要卡片 + 右侧走访列表
- 复用旧 page.tsx 的走访记录样式

#### 3.1 走访 API 扩展
- **文件**：`src/app/api/visits/route.ts`
- GET 不传 householdId 时返回所有走访记录（含住户名称）

### 阶段 4：家庭详情页补全

#### 4.1 添加成员功能
- **文件**：`src/app/(dashboard)/household/[id]/page.tsx`
- 点击"添加成员"弹出表单 Modal
- 字段：姓名、与户主关系、年龄、性别、标签
- 提交到 `POST /api/members`

#### 4.2 编辑住户功能
- 读取 `?edit=1` 参数，进入编辑模式
- 复用 HouseholdForm 组件

### 阶段 5：导入导出页面

- **文件**：`src/app/(dashboard)/transfer/page.tsx`
- Excel 导出：从 API 获取住户数据，前端生成 CSV 下载
- Excel 导入：文件选择 + 预览 + 确认导入（MVP 阶段）

### 阶段 6：系统设置页面

- **文件**：`src/app/(dashboard)/settings/page.tsx`
- 个人信息修改
- 地图默认中心点设置
- 关于系统信息

### 阶段 7：统计页面改进

#### 7.1 获取所有走访数据
- **文件**：`src/app/(dashboard)/statistics/page.tsx`
- 改为获取所有走访记录用于统计

#### 7.2 统计页面样式迁移
- 将内联 style 迁移到 globals.css
- 使用 CSS 类名保持一致性

### 阶段 8：CSS 清理与优化

- 清理 globals.css 中不再使用的旧 SVG 地图样式
- 统一家庭详情页的样式到 CSS 类
- 确保 mobile 响应式在所有页面正常

---

## 实施优先级

1. **阶段 1**：核心功能修复（路由守卫 + 退出登录 + Toast）← 最高优先
2. **阶段 2**：人员管理页面
3. **阶段 4**：家庭详情补全（添加成员 + 编辑）
4. **阶段 3**：入户记录页面
5. **阶段 7**：统计页面改进
6. **阶段 5**：导入导出
7. **阶段 6**：系统设置
8. **阶段 8**：CSS 清理

---

## 验证步骤

1. 未登录访问 `/map` 自动跳转到 `/login`
2. 登录后可正常使用，退出登录可清除状态
3. 操作成功/失败有 toast 提示
4. 人员管理页面可浏览、搜索、筛选住户
5. 家庭详情页可添加成员
6. 入户记录页面可浏览所有走访
7. 统计页面显示全量数据
8. 导入导出页面可下载 CSV
9. 移动端所有页面响应式正常
