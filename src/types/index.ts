// 标签类型
export type Tag =
  | "脱贫户"
  | "监测户"
  | "独居老人"
  | "留守儿童"
  | "精神障碍"
  | "残疾人"
  | "五保"
  | "低保";

// 住户
export type Household = {
  id: number;
  householdName: string;
  headName: string;
  phone: string;
  groupName: string;
  address: string;
  memberCount: number;
  tags: Tag[];
  latitude: string;
  longitude: string;
  lastVisitAt: string | null;
  createdAt?: string;
  // 最近一次带照片的走访图片URL（前端聚合，非数据库字段）
  lastVisitImage?: string;
};

// 走访记录
export type Visit = {
  id: number;
  householdId: number;
  visitor: string;
  visitDate: string;
  content: string;
  concerns: string[];
  images: string[];
  imageCount: number;
  createdAt?: string;
};

// 家庭成员
export type Member = {
  id: number;
  householdId: number;
  name: string;
  relation: string;
  age: number | null;
  gender: string | null;
  tags: Tag[];
  createdAt?: string;
};

// 用户
export type User = {
  id: number;
  username: string;
  displayName: string;
  role: string;
};
