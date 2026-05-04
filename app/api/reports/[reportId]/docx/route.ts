import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reportToDocxBuffer } from "@/lib/export/docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { data: report } = await supabase
    .from("brand_reports")
    .select("title, content, focus, created_at")
    .eq("id", reportId)
    .single();
  if (!report) return new NextResponse("not found", { status: 404 });

  const buffer = await reportToDocxBuffer(
    report.title,
    {
      generatedAt: new Date(report.created_at).toLocaleString("zh-TW"),
      focus: report.focus,
    },
    report.content
  );

  // Sanitize filename for HTTP header
  const fname = report.title.replace(/[^a-zA-Z0-9._\-一-鿿]/g, "_").slice(0, 80);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fname}.docx"; filename*=UTF-8''${encodeURIComponent(fname + ".docx")}`,
    },
  });
}
