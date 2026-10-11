-- =====================================================================
-- Supabase 대시보드 → SQL Editor → New query → 전체 붙여넣고 Run (1번만)
-- 기존 테이블(profiles, chat_sessions, chat_messages)의 데이터는 지워지지 않습니다.
-- vector(768): scripts/check_models.py가 출력한 SBERT 차원과 다르면 4군데 모두 바꾸세요.
-- =====================================================================

-- 0) 벡터 검색 기능 켜기
create extension if not exists vector;

-- 1) 직무 프로필 (취업진로.xlsx + 역량부족.xlsx 병합본)
create table if not exists job_profiles (
  id            bigserial primary key,
  category      text not null,               -- 대분류 (IT/SW, 디자인, 식·음료 ...)
  job_name      text not null,               -- 중분류 (백엔드개발자 ... / '직무 공통')
  is_common     boolean not null default false,
  aliases       text[] not null default '{}',
  keywords      text,  companies text,  main_tasks text,           -- 취업진로
  salary_low    int,   salary_mid int,  salary_high int,           -- 만원
  outlook_down  int,   outlook_same int, outlook_up int,           -- %
  certificates  text,  skills text,  majors text,  knowledge text, -- 역량부족
  profile_text  text not null,
  embedding     vector(768),
  unique (category, job_name)
);

-- 2) (선택) 고민 문장 데이터 — 고민 유형 추정용
create table if not exists kb_documents (
  id           bigserial primary key,
  concern_type text not null,                -- '취업진로' | '역량부족'
  content      text not null,
  source       text,
  embedding    vector(768)
);

-- 3) 검색 함수 (백엔드에서 rpc로 호출)
create or replace function match_documents(query_embedding vector(768), match_count int default 4)
returns table (id bigint, concern_type text, content text, similarity float)
language sql stable as $$
  select id, concern_type, content, 1 - (embedding <=> query_embedding)
  from kb_documents
  order by embedding <=> query_embedding
  limit match_count;
$$;

create or replace function match_jobs(query_embedding vector(768), match_count int default 3)
returns table (id bigint, category text, job_name text, similarity float)
language sql stable as $$
  select id, category, job_name, 1 - (embedding <=> query_embedding)
  from job_profiles
  where not is_common
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 4) 기존 chat_messages에 분석 결과 컬럼 추가 (기존 행은 빈 값으로 남음)
alter table chat_messages add column if not exists emotion        text;
alter table chat_messages add column if not exists emotion_conf   real;
alter table chat_messages add column if not exists concern_type   text;
alter table chat_messages add column if not exists job_name       text;
alter table chat_messages add column if not exists retrieved_ids  bigint[];
alter table chat_messages add column if not exists top_similarity real;
alter table chat_messages add column if not exists is_crisis      boolean default false;

-- 5) 보안: 새 테이블은 브라우저(anon 키)에서 못 보게. 백엔드(service_role)는 영향 없음.
alter table job_profiles enable row level security;
alter table kb_documents enable row level security;
