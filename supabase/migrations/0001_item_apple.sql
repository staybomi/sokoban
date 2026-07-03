-- 사과 인벤토리 저장용 테이블.
-- 게임에 로그인이 없으므로 단일 전역 행(id=1)에 사과 개수를 담는다.
create table if not exists public.item (
  id integer primary key,
  apple integer not null default 0
);

-- 기본 행 보장
insert into public.item (id, apple)
values (1, 0)
on conflict (id) do nothing;

-- RLS 활성화 + 익명(anon) 읽기/쓰기 허용 (로그인 없는 캐주얼 게임이므로)
alter table public.item enable row level security;

drop policy if exists "item anon select" on public.item;
create policy "item anon select" on public.item
  for select to anon using (true);

drop policy if exists "item anon insert" on public.item;
create policy "item anon insert" on public.item
  for insert to anon with check (true);

drop policy if exists "item anon update" on public.item;
create policy "item anon update" on public.item
  for update to anon using (true) with check (true);
