import fs from "fs";
import path from "path";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("file");

    if (!files || files.length === 0) {
      return Response.json({ message: "请选择文件" }, { status: 400 });
    }

    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const urls: string[] = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        return Response.json({ message: "无效的文件" }, { status: 400 });
      }

      // 文件大小校验
      if (file.size > MAX_FILE_SIZE) {
        return Response.json(
          { message: `文件 ${file.name} 超过 5MB 大小限制` },
          { status: 400 }
        );
      }

      // 文件类型校验
      if (!ALLOWED_TYPES.includes(file.type)) {
        return Response.json(
          { message: `文件 ${file.name} 格式不支持，仅支持 JPG/PNG/WebP` },
          { status: 400 }
        );
      }

      // 扩展名校验
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return Response.json(
          { message: `文件 ${file.name} 扩展名不支持` },
          { status: 400 }
        );
      }

      // 生成唯一文件名
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const filename = `${timestamp}-${random}${ext}`;

      // 保存文件
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);

      urls.push(`/uploads/${filename}`);
    }

    return Response.json({ urls });
  } catch (error) {
    console.error("上传失败", error);
    return Response.json({ message: "文件上传失败" }, { status: 500 });
  }
}
