import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reportToDocxBuffer } from "@/lib/export/docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new NextResponse("unauthorized", { status: 401 });

    const { data: report, error } = await supabase
      .from("brand_reports")
      .select("title, content, focus, created_at")
      .eq("id", reportId)
      .single();
    if (error || !report) {
      return new NextResponse(`not found: ${error?.message ?? "missing"}`, { status: 404 });
    }

    const buffer = await reportToDocxBuffer(
      report.title,
      {
        generatedAt: new Date(report.created_at).toLocaleString("zh-TW"),
        focus: report.focus,
      },
      report.content
    );

    // Build a Content-Disposition header that works with non-ASCII filenames
    // RFC 5987: ASCII fallback + filename* with UTF-8 percent-encoded
    const asciiFallback =
      report.title.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "").slice(0, 80) ||
      "loamia-report";
    const utf8Name = encodeURIComponent(report.title.slice(0, 80) + ".docx");
    const disposition = `attachment; filename="${asciiFallback}.docx"; filename*=UTF-8''${utf8Name}`;

    return new NextResponse(new Blob([new Uint8Array(buffer)]), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[docx export] failed:", err);
    return new NextResponse(
      `Export failed: ${err instanceof Error ? err.message : "unknown"}`,
      { status: 500 }
    );
  }
}
