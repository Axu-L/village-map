import { GROUP_NAMES } from "@/lib/constants";

/** 校验纬度：-90 ~ 90 */
export function validateLat(v: string | number): boolean {
  const n = Number(v);
  return !isNaN(n) && n >= -90 && n <= 90;
}

/** 校验经度：-180 ~ 180 */
export function validateLng(v: string | number): boolean {
  const n = Number(v);
  return !isNaN(n) && n >= -180 && n <= 180;
}

/** 校验手机号格式（中国大陆），空字符串允许 */
export function validatePhone(v: string): boolean {
  return v === "" || /^1[3-9]\d{9}$/.test(v);
}

/** 校验组别是否在 GROUP_NAMES 列表中 */
export function validateGroupName(v: string): boolean {
  return (GROUP_NAMES as readonly string[]).includes(v);
}

/** 校验家庭成员数：正整数 */
export function validateMemberCount(v: number): boolean {
  return Number.isInteger(v) && v >= 1 && v <= 50;
}

/** 校验年龄：0~150 或 null */
export function validateAge(v: number | null): boolean {
  if (v === null) return true;
  return !isNaN(v) && v >= 0 && v <= 150;
}

/** 校验性别：男 / 女 / null */
export function validateGender(v: string | null): boolean {
  if (v === null || v === "") return true;
  return v === "男" || v === "女";
}

/** 校验走访日期：合法的 YYYY-MM-DD 格式 */
export function validateVisitDate(v: string): boolean {
  if (!v) return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
}
