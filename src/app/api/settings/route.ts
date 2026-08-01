import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/amap";

export const dynamic = "force-dynamic";

// GET /api/settings —— 读取地图设置（多设备共享）
export async function GET() {
  try {
    const rows = await db.select().from(settings).limit(1);
    if (rows.length === 0) {
      return Response.json({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
      });
    }
    const row = rows[0];
    const lng = Number(row.centerLng);
    const lat = Number(row.centerLat);
    return Response.json({
      center: [lng, lat],
      zoom: row.zoom,
    });
  } catch (error) {
    console.error("Unable to load settings", error);
    return Response.json({ message: "读取设置失败" }, { status: 500 });
  }
}

// PUT /api/settings —— 保存地图设置（upsert，单行）
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const lng = Number(body?.center?.[0]);
    const lat = Number(body?.center?.[1]);
    const zoom = Number(body?.zoom);
    if (isNaN(lng) || isNaN(lat) || isNaN(zoom)) {
      return Response.json({ message: "参数无效" }, { status: 400 });
    }

    const rows = await db.select().from(settings).limit(1);
    const now = new Date().toISOString();
    if (rows.length > 0) {
      await db
        .update(settings)
        .set({
          centerLng: String(lng),
          centerLat: String(lat),
          zoom,
          updatedAt: now,
        })
        .where(eq(settings.id, rows[0].id));
    } else {
      await db.insert(settings).values({
        centerLng: String(lng),
        centerLat: String(lat),
        zoom,
        updatedAt: now,
      });
    }
    return Response.json({ center: [lng, lat], zoom });
  } catch (error) {
    console.error("Unable to save settings", error);
    return Response.json({ message: "保存设置失败" }, { status: 500 });
  }
}
