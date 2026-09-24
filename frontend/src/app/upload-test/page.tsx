import type { Metadata } from "next";
import ImageUploadLab from "@/components/ImageUploadLab";

export const metadata: Metadata = { title: "Image upload test | TXST Lynx" };
export const runtime = "nodejs";

export default function UploadTestPage() {
  return <ImageUploadLab />;
}
