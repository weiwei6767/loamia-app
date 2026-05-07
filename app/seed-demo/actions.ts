"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chunkText, buildChunkRows } from "@/lib/ai/ingest";

export type SeedResult =
  | { ok: true; brandId: string }
  | { ok: false; error: string };

const BRAND_NAME = "DEMO 手搖飲";

const BRAND_IDENTITY = `# Brand Identity — DEMO 手搖飲

## 定位
台北中山區精品手搖飲品牌，主打「真材實料 + 慢工細活」，以高品質茶葉與限量風味鎖定講究品質的 25-40 歲都市上班族。不打折扣戰，主打一杯值得停下來品嚐的下午時光。

## 目標受眾
- 25-40 歲女性為主（70%）、男性為輔（30%）
- 月收入 4 萬以上、住在雙北中心商業區
- 在 Threads / IG 上分享日常飲品、追求生活儀式感
- 對食品來源、健康概念敏感（少糖、無添加是加分項）

## 語氣指南
- 親切但不誇張，像認識的朋友推薦一家好店
- 多用「我們」「一起」「慢慢」這類詞，少用「最棒」「超強」「炸裂」
- 台味繁體中文，適度英文穿插（如「chill」「vibe」「mood」）
- 描述茶飲時用感官語言：「回甘」「韻味」「層次」「微苦轉甜」
- 不刻意賣萌，不用過多 emoji（每則 1-2 個就好）

## 禁忌詞
最便宜、最強、爆款、神級、絕對、跳樓大拍賣、手搖界天花板、誇張、瘋狂、無敵
`;

const CAMPAIGN_HISTORY = `# DEMO 手搖飲 · 過往檔期表現

## 2026 春季「新茶到」上市檔（3-4 月）
- 主打單品：日月潭紅茶款 + 阿里山金萱拿鐵
- 主視覺：手繪茶園 + 真實茶湯實拍
- IG 觸及：累積 12.4 萬，互動率 4.8%（高於品牌平均 3.2%）
- Threads：單則最高轉發 2,300，留言區出現多筆「真的有回甘」「跟一般的不一樣」UGC
- 單店銷量：4 月旗艦店比 3 月成長 +27%
- 教訓：素人試喝影片比品牌官方文案有效 3 倍，但中間夾雜的硬性「優惠價」貼文壓 reach

## 2026 母親節「孝心三杯組」（4 月底-5/12）
- 包裝改用品牌色禮盒 + 手寫卡片
- 線上預購 → 全台統倉到店取
- 預購峰值落在 5/8（母親節前 4 天）
- 銷量：原訂 1,500 組 → 實際 1,820 組
- 客訴：3 件「卡片印錯」、5 件「冰太多」→ 5/10 起調整出貨流程

## Winning Memory
- 用「下午 3 點茶歇 mood」這類情境貼文取代產品照，互動率提升 2 倍
- 留言回覆風格：先共感（「下午這時段最需要一杯！」）再簡短分享（「我們也是把茶當生活儀式」），不直接推銷
- 避免「快來買」「限量秒殺」這類緊迫感字眼，目標客群會反感
`;

const KOLS = [
  {
    name: "陳薇安",
    handle: "@vivian.lifestyle",
    platform: "instagram",
    profile_url: "https://instagram.com/vivian.lifestyle",
    followers: 48000,
    niche_tags: ["生活", "下午茶", "台北"],
    contact_email: "vivian@example.com",
    rate_note: "1 篇 IG post + 1 則 story 約 NTD 18,000",
    status: "contacted",
    campaign_name: "2026 母親節",
    rate_paid: null,
    collab_notes: "已合作 2 次，互動率穩定 5%+，配合度高，適合長期",
  },
  {
    name: "李子翔",
    handle: "@chris.eats.tw",
    platform: "instagram",
    profile_url: "https://instagram.com/chris.eats.tw",
    followers: 132000,
    niche_tags: ["美食", "飲料", "雙北"],
    contact_email: "chris@agency.com",
    rate_note: "1 IG reel NTD 35,000；含 1 則 Threads 補推 +5,000",
    status: "completed",
    campaign_name: "2026 春季新茶到",
    rate_paid: "40000",
    collab_notes: "reel 觸及 24 萬，導購 287 杯（透過追蹤碼），ROAS 約 1.7",
  },
  {
    name: "Emily Chen",
    handle: "@emily.cafestop",
    platform: "threads",
    profile_url: "https://threads.com/@emily.cafestop",
    followers: 8500,
    niche_tags: ["咖啡", "茶飲", "心情"],
    contact_email: null,
    rate_note: "微網紅，目前互換產品試喝即可",
    status: "researching",
    campaign_name: null,
    rate_paid: null,
    collab_notes: "貼文風格自然、真實感強，準備發信邀約 2026 夏季限定",
  },
  {
    name: "韓筠瑀",
    handle: "@yuyu.afternoon",
    platform: "instagram",
    profile_url: "https://instagram.com/yuyu.afternoon",
    followers: 22000,
    niche_tags: ["少糖", "健康", "下午茶"],
    contact_email: "yuyu@kolagency.tw",
    rate_note: "1 篇 NTD 12,000",
    status: "completed",
    campaign_name: "2026 春季新茶到",
    rate_paid: "12000",
    collab_notes: "成效中等，留言互動較少；下次可改 reel 形式",
  },
  {
    name: "蘇子翔",
    handle: "@suzy_drinks",
    platform: "youtube",
    profile_url: "https://youtube.com/@suzy_drinks",
    followers: 76000,
    niche_tags: ["飲料評測", "台北"],
    contact_email: "suzy.team@agency.com",
    rate_note: "5 分鐘片約 NTD 60,000",
    status: "researching",
    campaign_name: null,
    rate_paid: null,
    collab_notes: "頻道風格客觀，不會過度美化，適合做產品 stress test 用",
  },
];

async function ensureBrandIdentityDoc(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  brand: { id: string; agency_id: string }
) {
  const buffer = Buffer.from(BRAND_IDENTITY, "utf-8");
  const storagePath = `${brand.agency_id}/${brand.id}/seed-${Date.now()}-identity.txt`;
  await supabase.storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: "text/plain", upsert: false });

  const { data: doc } = await supabase
    .from("documents")
    .insert({
      brand_id: brand.id,
      agency_id: brand.agency_id,
      filename: "Brand Identity（DEMO 手搖飲）.txt",
      storage_path: storagePath,
      mime_type: "text/plain",
      byte_size: buffer.length,
      status: "processing",
      progress_pct: 30,
      tags: ["brand_identity", "system", "seed"],
    })
    .select("id")
    .single();
  if (!doc) return;

  const chunks = chunkText(BRAND_IDENTITY);
  const rows = await buildChunkRows(chunks, doc.id, brand.id, brand.agency_id);
  if (rows.length > 0) await supabase.from("document_chunks").insert(rows);

  await supabase
    .from("documents")
    .update({ status: "ready", progress_pct: 100 })
    .eq("id", doc.id);
}

async function ensureCampaignHistoryDoc(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  brand: { id: string; agency_id: string }
) {
  const buffer = Buffer.from(CAMPAIGN_HISTORY, "utf-8");
  const storagePath = `${brand.agency_id}/${brand.id}/seed-${Date.now()}-campaigns.txt`;
  await supabase.storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: "text/plain", upsert: false });

  const { data: doc } = await supabase
    .from("documents")
    .insert({
      brand_id: brand.id,
      agency_id: brand.agency_id,
      filename: "DEMO 手搖飲 · 過往檔期報告.txt",
      storage_path: storagePath,
      mime_type: "text/plain",
      byte_size: buffer.length,
      status: "processing",
      progress_pct: 30,
      tags: ["campaign_history", "seed"],
    })
    .select("id")
    .single();
  if (!doc) return;

  const chunks = chunkText(CAMPAIGN_HISTORY);
  const rows = await buildChunkRows(chunks, doc.id, brand.id, brand.agency_id);
  if (rows.length > 0) await supabase.from("document_chunks").insert(rows);

  await supabase
    .from("documents")
    .update({ status: "ready", progress_pct: 100 })
    .eq("id", doc.id);
}

const BRAND_IDENTITY_FIELDS = {
  positioning:
    "台北中山區精品手搖飲品牌，主打「真材實料 + 慢工細活」，以高品質茶葉與限量風味鎖定講究品質的 25-40 歲都市上班族。不打折扣戰，主打一杯值得停下來品嚐的下午時光。",
  target_audience:
    "25-40 歲都市上班族（女性 70%、男性 30%），月收入 4 萬以上、住雙北中心商業區，在 Threads / IG 分享日常飲品、追求生活儀式感，對食品來源與少糖無添加敏感。",
  tone_guide:
    "親切但不誇張，像認識的朋友推薦一家好店。多用「我們」「一起」「慢慢」，少用「最棒」「超強」「炸裂」。台味繁中，適度英文（chill / vibe / mood）。描述茶飲用感官語言（回甘、韻味、層次、微苦轉甜）。每則 1-2 個 emoji 為限。",
  taboo_words: [
    "最便宜",
    "最強",
    "爆款",
    "神級",
    "絕對",
    "跳樓大拍賣",
    "手搖界天花板",
    "誇張",
    "瘋狂",
    "無敵",
  ],
};

const MONITOR_HISTORY = [
  {
    source_text:
      "今天下午想喝茶，想找台北中山附近不錯的手搖店，要茶葉品質好的，求推薦",
    source_type: "Threads · @taipei_drinks_lover",
    tone: "親切",
    suggestions: [
      "下午 3 點剛好是我們最忙的時段呢，中山這邊的茶飲選擇真的滿多的，每家風格都不太一樣，可以挑自己順眼的試試 ☕",
      "中山附近還滿幸福的，茶飲品質有水準的店其實不少。想要茶葉本味突出一點的話，可以找標榜「單品茶」的，少糖喝下去比較分得出層次。",
      "我們在中山這邊也有店，主打日月潭紅茶跟阿里山金萱，下午 3-5 點這個時段比較有位子可以坐下來慢慢喝～",
    ],
    picked_index: 1,
    sent_text:
      "中山附近還滿幸福的，茶飲品質有水準的店其實不少。想要茶葉本味突出一點的話，可以找標榜「單品茶」的，少糖喝下去比較分得出層次。",
    days_ago: 3,
    outcome: "replied",
  },
  {
    source_text: "母親節送什麼飲料禮盒比較不踩雷？預算 1500 內",
    source_type: "Threads · @gift_ideas_taipei",
    tone: "專業",
    suggestions: [
      "茶禮盒比較不會出錯，挑那種有手寫卡片的會更有心意。1500 預算抓 3 杯左右算是剛好，喝得完不浪費。",
      "母親節飲料禮盒我覺得茶款比咖啡保險，長輩接受度高很多。可以找有冷熱兩飲的，這樣媽媽什麼時候想喝都行。",
      "預算 1500 內的話我們家剛好有「孝心三杯組」，含日月潭紅茶 + 金萱拿鐵 + 季節限定，附手寫卡片，可參考看看。",
    ],
    picked_index: 2,
    sent_text:
      "預算 1500 內的話我們家剛好有「孝心三杯組」，含日月潭紅茶 + 金萱拿鐵 + 季節限定，附手寫卡片，可參考看看。",
    days_ago: 1,
    outcome: "converted",
  },
];

export async function seedDemoBrand(): Promise<SeedResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "請先登入" };

  const { data: memberships } = await supabase
    .from("agency_members")
    .select("agency_id")
    .limit(1);
  const agencyId = memberships?.[0]?.agency_id;
  if (!agencyId) return { ok: false, error: "找不到 agency，請先完成 onboarding" };

  const errors: string[] = [];

  // ── Brand (idempotent: reuse if exists, else create with Identity columns) ──
  let brand: { id: string; agency_id: string };
  const { data: existing } = await supabase
    .from("brands")
    .select("id, agency_id, positioning, target_audience, tone_guide, taboo_words")
    .eq("agency_id", agencyId)
    .eq("name", BRAND_NAME)
    .limit(1)
    .maybeSingle();

  if (existing) {
    brand = { id: existing.id as string, agency_id: existing.agency_id as string };
    // Backfill Brand Identity if missing (older seed didn't populate these)
    const needsBackfill =
      !existing.positioning ||
      !existing.target_audience ||
      !existing.tone_guide ||
      !existing.taboo_words ||
      (existing.taboo_words as string[]).length === 0;
    if (needsBackfill) {
      const { error } = await supabase
        .from("brands")
        .update(BRAND_IDENTITY_FIELDS)
        .eq("id", brand.id);
      if (error) errors.push(`brand identity backfill: ${error.message}`);
    }
  } else {
    const { data: created, error: brandErr } = await supabase
      .from("brands")
      .insert({
        name: BRAND_NAME,
        agency_id: agencyId,
        ...BRAND_IDENTITY_FIELDS,
      })
      .select("id, agency_id")
      .single();
    if (brandErr || !created) {
      return { ok: false, error: brandErr?.message ?? "建立 brand 失敗" };
    }
    brand = { id: created.id as string, agency_id: created.agency_id as string };
  }

  // ── Documents (skip if already has seeded ones with tag="seed") ──
  const { data: seededDocs } = await supabase
    .from("documents")
    .select("id")
    .eq("brand_id", brand.id)
    .contains("tags", ["seed"]);
  if (!seededDocs || seededDocs.length === 0) {
    try {
      await ensureBrandIdentityDoc(supabase, brand);
    } catch (err) {
      errors.push(`identity doc: ${err instanceof Error ? err.message : "fail"}`);
    }
    try {
      await ensureCampaignHistoryDoc(supabase, brand);
    } catch (err) {
      errors.push(`campaign doc: ${err instanceof Error ? err.message : "fail"}`);
    }
  }

  // ── KOLs (skip individual ones already in DB by name) ──
  const { data: existingKols } = await supabase
    .from("brand_kols")
    .select("name")
    .eq("brand_id", brand.id);
  const existingKolNames = new Set(
    ((existingKols ?? []) as { name: string }[]).map((k) => k.name)
  );
  const newKols = KOLS.filter((k) => !existingKolNames.has(k.name));
  if (newKols.length > 0) {
    const { error } = await supabase.from("brand_kols").insert(
      newKols.map((k) => ({
        agency_id: brand.agency_id,
        brand_id: brand.id,
        user_id: user.id,
        ...k,
      }))
    );
    if (error) errors.push(`kols: ${error.message}`);
  }

  // ── Post template (skip if already exists by name) ──
  const { data: existingTmpl } = await supabase
    .from("post_templates")
    .select("id")
    .eq("brand_id", brand.id)
    .eq("name", "每日下午茶 mood")
    .limit(1);
  if (!existingTmpl || existingTmpl.length === 0) {
    const nextRun = new Date();
    nextRun.setUTCHours(nextRun.getUTCHours() + 1);
    const { error } = await supabase.from("post_templates").insert({
      agency_id: brand.agency_id,
      brand_id: brand.id,
      user_id: user.id,
      name: "每日下午茶 mood",
      prompt:
        "寫一則 Threads 貼文，分享 DEMO 手搖飲下午 3-4 點的 chill mood，語氣像跟朋友聊天。可以提到一款主打商品，但不要硬推銷。",
      recurrence: "daily",
      weekday: null,
      time_of_day: "15:00",
      interval_hours: null,
      tz_offset_minutes: -480,
      next_run_at: nextRun.toISOString(),
      next_post_text: null,
      comments: ["📍 中山店今天還有現場座位歡迎來坐坐"],
      enable_web_tools: false,
      active: true,
    });
    if (error) errors.push(`template: ${error.message}`);
  }

  // ── Monitor replies (skip if already exists by source_text) ──
  const { data: existingMonitor } = await supabase
    .from("monitor_replies")
    .select("source_text")
    .eq("brand_id", brand.id);
  const existingSources = new Set(
    ((existingMonitor ?? []) as { source_text: string }[]).map((m) => m.source_text)
  );
  const newMonitor = MONITOR_HISTORY.filter(
    (m) => !existingSources.has(m.source_text)
  );
  if (newMonitor.length > 0) {
    const { error } = await supabase.from("monitor_replies").insert(
      newMonitor.map((m) => ({
        brand_id: brand.id,
        agency_id: brand.agency_id,
        user_id: user.id,
        source_text: m.source_text,
        source_type: m.source_type,
        tone: m.tone,
        suggestions: m.suggestions,
        threads_url: null,
        picked_index: m.picked_index,
        sent_text: m.sent_text,
        sent_at: new Date(Date.now() - 86400000 * m.days_ago).toISOString(),
        sent_platform: "threads",
        outcome: m.outcome,
      }))
    );
    if (error) errors.push(`monitor: ${error.message}`);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: `部分資料未灌入：${errors.join(" | ")}（brand 已建立 ${brand.id}）`,
    };
  }
  return { ok: true, brandId: brand.id };
}

export async function seedDemoBrandAndRedirect(): Promise<void> {
  const result = await seedDemoBrand();
  if (result.ok) redirect(`/brand/${result.brandId}`);
}

/**
 * Delete ALL "DEMO 手搖飲" brands in the user's agency. Use this to clean up
 * duplicates accidentally created by clicking the seed button multiple times.
 */
export async function deleteAllDemoBrands(): Promise<{ ok: boolean; deleted: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, deleted: 0, error: "未登入" };

  const { data: memberships } = await supabase
    .from("agency_members")
    .select("agency_id")
    .limit(1);
  const agencyId = memberships?.[0]?.agency_id;
  if (!agencyId) return { ok: false, deleted: 0, error: "找不到 agency" };

  const { data: brands } = await supabase
    .from("brands")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("name", BRAND_NAME);
  if (!brands || brands.length === 0) {
    return { ok: true, deleted: 0 };
  }
  const ids = brands.map((b) => b.id as string);
  const { error } = await supabase.from("brands").delete().in("id", ids);
  if (error) return { ok: false, deleted: 0, error: error.message };
  return { ok: true, deleted: ids.length };
}
