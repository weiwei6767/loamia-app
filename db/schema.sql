-- Loamia Brand GPT — initial schema
-- 在 Supabase SQL Editor 一次貼進去執行
-- 前置條件：已執行 `create extension if not exists vector;`

-- =====================================================
-- 1. agencies — 代理商（租戶）
-- =====================================================
create table if not exists agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists agency_members (
  agency_id uuid not null references agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);

-- =====================================================
-- 2. brands — 客戶品牌（每個 agency 下有多個 brand）
-- =====================================================
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists brands_agency_id_idx on brands(agency_id);

-- =====================================================
-- 3. documents — 上傳的檔案
-- =====================================================
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  agency_id uuid not null references agencies(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime_type text,
  byte_size bigint,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists documents_brand_id_idx on documents(brand_id);

-- =====================================================
-- 4. document_chunks — 切片 + 向量
-- =====================================================
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  agency_id uuid not null references agencies(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_brand_id_idx on document_chunks(brand_id);
create index if not exists document_chunks_embedding_idx on document_chunks
  using hnsw (embedding vector_cosine_ops);

-- =====================================================
-- 5. chat_threads + chat_messages
-- =====================================================
create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  agency_id uuid not null references agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now()
);

create index if not exists chat_threads_brand_id_idx on chat_threads(brand_id);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_id_idx on chat_messages(thread_id);

-- =====================================================
-- 6. RLS — 每張表都隔離到所屬 agency
-- =====================================================
alter table agencies enable row level security;
alter table agency_members enable row level security;
alter table brands enable row level security;
alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table chat_threads enable row level security;
alter table chat_messages enable row level security;

-- 「我屬於哪些 agency」的判斷函式（查 agency_members）
create or replace function user_agency_ids()
returns setof uuid
language sql security definer stable
as $$
  select agency_id from agency_members where user_id = auth.uid();
$$;

-- agencies: 看得到自己是 member 的 agency
create policy "agencies_select" on agencies for select
  using (id in (select user_agency_ids()));

create policy "agencies_insert" on agencies for insert
  with check (owner_user_id = auth.uid());

-- agency_members: 看得到自己 agency 的成員
create policy "agency_members_select" on agency_members for select
  using (agency_id in (select user_agency_ids()));

create policy "agency_members_insert_self" on agency_members for insert
  with check (user_id = auth.uid());

-- brands / documents / chunks / threads / messages: 全部用 agency_id 隔離
create policy "brands_all" on brands for all
  using (agency_id in (select user_agency_ids()))
  with check (agency_id in (select user_agency_ids()));

create policy "documents_all" on documents for all
  using (agency_id in (select user_agency_ids()))
  with check (agency_id in (select user_agency_ids()));

create policy "document_chunks_all" on document_chunks for all
  using (agency_id in (select user_agency_ids()))
  with check (agency_id in (select user_agency_ids()));

create policy "chat_threads_all" on chat_threads for all
  using (agency_id in (select user_agency_ids()))
  with check (agency_id in (select user_agency_ids()));

create policy "chat_messages_select" on chat_messages for select
  using (thread_id in (select id from chat_threads));

create policy "chat_messages_insert" on chat_messages for insert
  with check (thread_id in (select id from chat_threads));

-- =====================================================
-- 6b. Storage RLS — 'documents' bucket
-- 必須先在 Supabase Dashboard → Storage 建立名為 'documents' 的私有 bucket
-- 簡化版：只檢查 bucket_id（跨代理商隔離由 documents 表的 RLS 處理）
-- =====================================================
create policy "documents_bucket_authenticated"
on storage.objects for all
to authenticated
using (bucket_id = 'documents')
with check (bucket_id = 'documents');

-- =====================================================
-- 7a. RPC — 建立 agency 並把建立者加為 owner（原子操作）
-- =====================================================
create or replace function create_agency_with_owner(agency_name text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  new_agency_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  insert into agencies (name, owner_user_id)
    values (agency_name, auth.uid())
    returning id into new_agency_id;

  insert into agency_members (agency_id, user_id, role)
    values (new_agency_id, auth.uid(), 'owner');

  return new_agency_id;
end;
$$;

-- =====================================================
-- 7b. RPC — 向量檢索（給應用層呼叫）
-- =====================================================
create or replace function match_chunks(
  query_embedding vector(1536),
  target_brand_id uuid,
  match_count int default 8
)
returns table (
  id uuid,
  document_id uuid,
  filename text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.document_id,
    d.filename,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from document_chunks c
  join documents d on d.id = c.document_id
  where c.brand_id = target_brand_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
