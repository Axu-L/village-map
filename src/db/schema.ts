import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const households = sqliteTable("households", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  householdName: text("household_name").notNull(),
  headName: text("head_name").notNull(),
  phone: text("phone").notNull(),
  groupName: text("group_name").notNull(),
  address: text("address").notNull(),
  memberCount: integer("member_count").notNull().default(1),
  tags: text("tags").notNull().default("[]"),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  lastVisitAt: text("last_visit_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const visits = sqliteTable("visits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  householdId: integer("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  visitor: text("visitor").notNull(),
  visitDate: text("visit_date").notNull(),
  content: text("content").notNull(),
  concerns: text("concerns").notNull().default("[]"),
  images: text("images").notNull().default("[]"),
  imageCount: integer("image_count").notNull().default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  householdId: integer("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  relation: text("relation").notNull(),
  age: integer("age"),
  gender: text("gender"),
  tags: text("tags").notNull().default("[]"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// 地图设置（单行 KV，多设备共享）
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  centerLng: text("center_lng").notNull(),
  centerLat: text("center_lat").notNull(),
  zoom: integer("zoom").notNull().default(16),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});
