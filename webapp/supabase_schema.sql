-- ============================================================
-- 时习 Web 学习平台 · Supabase 建表脚本
-- 在 Supabase 控制台 → SQL Editor 里整段执行即可。
-- 每个业务表都带 RLS（行级安全），用户只能读写自己的数据。
-- ============================================================

-- 1) 分类
create table if not exists public.categories (
  id text primary key,
  user_id text not null,
  account_id text not null,
  name text not null,
  color text not null default '#F42B45',
  sort_order integer not null default 0,
  created_at bigint not null,
  updated_at bigint not null default 0
);
alter table public.categories enable row level security;

-- 2) 知识点
create table if not exists public.topics (
  id text primary key,
  user_id text not null,
  account_id text not null,
  category_id text not null,
  title text not null,
  intro text not null default '',
  answer text not null default '',
  relations text not null default '',
  mastery text not null default '未掌握',
  state text not null default 'new',
  reps integer not null default 0,
  lapses integer not null default 0,
  difficulty double precision,
  stability double precision,
  due bigint not null,
  last_review bigint,
  scheduled_days integer not null default 0,
  created_at bigint not null,
  updated_at bigint not null
);
alter table public.topics enable row level security;

-- 3) 复习记录
create table if not exists public.review_logs (
  id text primary key,
  user_id text not null,
  account_id text not null,
  topic_id text not null,
  rating integer not null,
  scheduled_days integer not null default 0,
  elapsed_days double precision not null default 0,
  reviewed_at bigint not null,
  state_before text not null default 'new',
  state_after text not null default 'new'
);
alter table public.review_logs enable row level security;

-- 4) 专注记录
create table if not exists public.focus_sessions (
  id text primary key,
  user_id text not null,
  account_id text not null,
  started_at bigint not null,
  ended_at bigint not null,
  duration_sec integer not null default 0,
  topic_ids jsonb not null default '[]',
  note text not null default ''
);
alter table public.focus_sessions enable row level security;

-- 5) 聊天会话
create table if not exists public.chats (
  id text primary key,
  user_id text not null,
  account_id text not null,
  title text not null default '新对话',
  mode text not null default 'socratic',
  context text,
  created_at bigint not null,
  updated_at bigint not null
);
alter table public.chats enable row level security;

-- 6) 聊天消息
create table if not exists public.messages (
  id text primary key,
  user_id text not null,
  account_id text not null,
  session_id text not null,
  role text not null,
  content text not null default '',
  image text,
  created_at bigint not null
);
alter table public.messages enable row level security;

-- ============================================================
-- RLS 策略：user_id = auth.uid() 才能读写自己的行
-- 说明：auth.uid() 是 Supabase 当前登录用户的 UUID。
--       客户端上传时需把 user_id 填成 auth.uid()（即 account_id 去掉 "sb:" 前缀）。
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array['categories','topics','review_logs','focus_sessions','chats','messages']
  loop
    execute format('drop policy if exists "own_select_%s" on public.%I', t, t);
    execute format('create policy "own_select_%s" on public.%I for select using (user_id = auth.uid())', t, t);
    execute format('drop policy if exists "own_insert_%s" on public.%I', t, t);
    execute format('create policy "own_insert_%s" on public.%I for insert with check (user_id = auth.uid())', t, t);
    execute format('drop policy if exists "own_update_%s" on public.%I', t, t);
    execute format('create policy "own_update_%s" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format('drop policy if exists "own_delete_%s" on public.%I', t, t);
    execute format('create policy "own_delete_%s" on public.%I for delete using (user_id = auth.uid())', t, t);
  end loop;
end $$;