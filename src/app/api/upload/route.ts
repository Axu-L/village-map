import fs from "fs";
import path from "path";
import crypto from "crypto";
import { MAX_UPLOAD_SIZE } from "@/lib/constants";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("file");

    if (!files || files.length === 0) {
      return Response.json({ message: "请选择文件" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const urls: string[] = [];
    const failures: { name: string; reason: string }[] = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        failures.push({ name: "未知", reason: "无效的文件" });
        continue;
      }

      // 文件大小校验
      if (file.size > MAX_UPLOAD_SIZE) {
        failures.push({ name: file.name, reason: "超过 5MB 大小限制" });
        continue;
      }

      // 文件类型校验
      if (!ALLOWED_TYPES.includes(file.type)) {
        failures.push({ name: file.name, reason: "格式不支持，仅支持 JPG/PNG/WebP" });
        continue;
      }

      // 扩展名校验
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        failures.push({ name: file.name, reason: "扩展名不支持" });
        continue;
      }

      try {
        // 用 crypto.randomUUID() 生成唯一文件名，避免碰撞
        const filename = `${crypto.randomUUID()}${ext}`;

        // 保存文件
        const buffer = Buffer.from(await file.arrayBuffer());
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, buffer);

        urls.push(`/uploads/${filename}`);
      } catch (err) {
        console.error(`保存文件 ${file.name} 失败`, err);
        failures.push({ name: file.name, reason: "保存失败" });
      }
    }

    // 即使部分失败也返回已成功的 urls + 失败列表
    return Response.json({ urls, failures });
  } catch (error) {
    console.error("上传失败", error);
    return Response.json({ message: "文件上传失败" }, { status: 500 });
  }
}
