// 走访到达阈值（米）：走访模式下到达住户此距离内自动弹窗
export const VISIT_ARRIVE_THRESHOLD = 50;

// 定位轮询间隔（毫秒）
export const GEOLOCATION_INTERVAL = 10000;

// 单文件上传大小上限（字节）
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

// 组别名称（统一维护，避免多文件硬编码不一致）
export const GROUP_NAMES = [
  "第一组", "第二组", "第三组", "第四组", "第五组",
  "第六组", "第七组", "第八组", "第九组", "第十组",
] as const;

/**
 * 读取当前登录用户的 displayName 作为默认走访人
 * 兜底返回 "管理员"
 */
export function getVisitorDefault(): string {
  if (typeof window === "undefined") return "管理员";
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "管理员";
    const u = JSON.parse(raw);
    return u?.displayName || "管理员";
  } catch {
    return "管理员";
  }
}
