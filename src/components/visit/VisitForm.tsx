"use client";

import { useState, FormEvent, useRef } from "react";
import { X, Upload, Image, Loader2 } from "lucide-react";
import { apiUrl, assetUrl } from "@/lib/api";

interface VisitFormProps {
  householdId: number;
  householdName: string;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

const CONCERN_OPTIONS = ["住房", "收入", "教育", "医疗"];

export function VisitForm({
  householdId,
  householdName,
  onSave,
  onClose,
}: VisitFormProps) {
  const [visitDate, setVisitDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [visitor, setVisitor] = useState("管理员");
  const [content, setContent] = useState("");
  const [concerns, setConcerns] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleConcern = (item: string) => {
    setConcerns((prev) =>
      prev.includes(item) ? prev.filter((c) => c !== item) : [...prev, item]
    );
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      fileArray.forEach((file) => {
        formData.append("file", file);
      });

      const res = await fetch(apiUrl("/api/upload"), {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.message || "上传失败");
        return;
      }

      if (data.urls && Array.isArray(data.urls)) {
        setImages((prev) => [...prev, ...data.urls]);
      }
    } catch {
      setUploadError("网络错误，上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({
      householdId,
      visitor,
      visitDate,
      content,
      concerns,
      images,
    });
  };

  return (
    <div className="modal-layer" onClick={onClose}>
      <div className="visit-form-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow">{householdName}</span>
            <h2>新增走访</h2>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>走访日期</label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label>走访人员</label>
            <input
              value={visitor}
              onChange={(e) => setVisitor(e.target.value)}
              placeholder="走访人姓名"
            />
          </div>

          <div className="form-field">
            <label>走访内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="请记录走访内容..."
              rows={4}
            />
          </div>

          <div className="form-field">
            <label>关注事项</label>
            <div className="tag-select-group">
              {CONCERN_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`tag-select-btn ${concerns.includes(item) ? "active" : ""}`}
                  onClick={() => toggleConcern(item)}
                >
                  {concerns.includes(item) && "✓ "}
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label>图片上传</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <div
              className="upload-area"
              style={{ cursor: uploading ? "wait" : "pointer" }}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {uploading ? (
                <>
                  <Loader2 size={24} className="spin" />
                  <p>上传中...</p>
                </>
              ) : (
                <>
                  <Upload size={24} />
                  <p>点击或拖拽图片到此处</p>
                  <span>支持 JPG、PNG、WebP 格式，单文件最大 5MB</span>
                </>
              )}
            </div>

            {uploadError && (
              <p style={{ color: "var(--color-danger, #ef4444)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                {uploadError}
              </p>
            )}

            {images.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                {images.map((url, index) => (
                  <div
                    key={index}
                    style={{
                      position: "relative",
                      width: "80px",
                      height: "80px",
                      borderRadius: "6px",
                      overflow: "hidden",
                      border: "1px solid var(--color-border, #e2e8f0)",
                    }}
                  >
                    <img
                      src={assetUrl(url)}
                      alt={`图片 ${index + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      style={{
                        position: "absolute",
                        top: "2px",
                        right: "2px",
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.5)",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" className="save-button" disabled={!content.trim()}>
            保存走访记录
          </button>
        </form>
      </div>
    </div>
  );
}
