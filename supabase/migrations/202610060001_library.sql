-- Run once in a new Supabase project. No service role is used by the application.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table public.user_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version integer not null default 1 check (version = 1),
 interests text[] not null default '{}',
 updated_at timestamptz not null default now()
);
create table public.user_sources (
 user_id uuid not null references auth.users(id) on delete cascade,
 source_id text not null,
 kind text not null check (kind in ('curated','custom')),
 metadata jsonb,
 position integer not null,
 primary key (user_id, source_id)
);
create table public.saved_items (
 user_id uuid not null references auth.users(id) on delete cascade,
 item_key text not null,
 item_type text not null check (item_type in ('externalArticle','wikipediaDiscovery','artwork','legacyCultural')),
 snapshot jsonb not null,
 saved_at timestamptz not null default now(),
 primary key (user_id,item_key)
);
create table public.magazine_issues (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 issue_number integer not null check (issue_number > 0),
 issue_date date not null,
 created_at timestamptz not null default now(),
 preferences_snapshot jsonb not null,
 composition jsonb not null,
 unique (user_id, issue_date),
 unique (user_id, issue_number)
);
create table public.magazine_issue_items (
 issue_id uuid not null references public.magazine_issues(id) on delete cascade,
 position integer not null,
 item_type text not null check (item_type in ('externalArticle','wikipediaDiscovery','artwork','legacyCultural','history')),
 section text not null,
 source_id text not null,
 external_id text not null,
 original_url text not null,
 snapshot jsonb not null,
 primary key(issue_id,position)
);
create index magazine_issues_owner_date on public.magazine_issues(user_id,issue_date desc);
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_sources enable row level security;
alter table public.saved_items enable row level security;
alter table public.magazine_issues enable row level security;
alter table public.magazine_issue_items enable row level security;
create policy profiles_owner on public.profiles for all to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy preferences_owner on public.user_preferences for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy sources_owner on public.user_sources for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy saved_owner on public.saved_items for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Issues are immutable to the public API; only the creation RPC may insert them.
create policy issues_read_owner on public.magazine_issues for select to authenticated using (user_id=(select auth.uid()));
create policy issue_items_read_owner on public.magazine_issue_items for select to authenticated using (exists (select 1 from public.magazine_issues i where i.id=issue_id and i.user_id=(select auth.uid())));
revoke all on public.profiles,public.user_preferences,public.user_sources,public.saved_items,public.magazine_issues,public.magazine_issue_items from anon;
grant select,insert,update,delete on public.profiles,public.user_preferences,public.user_sources,public.saved_items to authenticated;
revoke insert,update,delete on public.magazine_issues,public.magazine_issue_items from authenticated;
grant select on public.magazine_issues,public.magazine_issue_items to authenticated;

-- Defense in depth: even direct REST/RPC writes cannot store publisher bodies,
-- excerpts or images under an editorial snapshot. Source metadata is also whitelisted.
create function public.clean_snapshot(value jsonb, kind text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare result jsonb; source jsonb;
begin
 if kind='wikipediaDiscovery' and (value->'source'->>'id' is distinct from 'wikipedia' or value->>'contentPolicy' is distinct from 'reusable') then raise exception 'Invalid reusable source'; end if;
 if kind='artwork' and (value->'source'->>'id' is distinct from 'met' or value->>'contentPolicy' is distinct from 'reusable') then raise exception 'Invalid reusable source'; end if;
 if kind='externalArticle' and value->>'contentPolicy' is distinct from 'external' then raise exception 'Invalid publisher snapshot'; end if;
 if kind='history' then
  return (select coalesce(jsonb_object_agg(key,val),'{}') from jsonb_each(value) as x(key,val) where key=any(array['id','year','text','sourceUrl','relatedPage']));
 end if;
 select coalesce(jsonb_object_agg(key,val),'{}') into source from jsonb_each(coalesce(value->'source','{}')) as x(key,val)
 where key=any(array['id','name','slug','websiteUrl','feedUrl','sourceType','categories','license','isMock']);
 if kind='externalArticle' then
  select coalesce(jsonb_object_agg(key,val),'{}') into result from jsonb_each(value) as x(key,val)
  where key=any(array['id','title','url','sourceType','contentPolicy','category','interestIds','publishedAt','readingTime','author']);
  source := source || jsonb_build_object('contentPolicy',jsonb_build_object('destination','external','canDisplayTitle',true,'canDisplayAuthor',true,'canDisplayDate',true,'canDisplayExcerpt',false,'canDisplayImage',false,'canDisplayFullText',false));
 else
  select coalesce(jsonb_object_agg(key,val),'{}') into result from jsonb_each(value) as x(key,val)
  where key=any(array['id','kind','title','description','image','contentPolicy','originalUrl','internalUrl','artist','year','attribution','pageId','revisionId','extract','textLicense','objectId','isPublicDomain','medium','department','culture','dimensions','creditLine','accessionNumber']);
  -- Reusable providers have their own verified adapters; keep attribution with snapshots.
  if kind='artwork' and value->>'isPublicDomain' is distinct from 'true' then raise exception 'Artwork is not confirmed public domain'; end if;
 end if;
 return result || jsonb_build_object('source',source);
end $$;
create function public.clean_saved_write() returns trigger language plpgsql set search_path='' as $$
begin new.snapshot:=public.clean_snapshot(new.snapshot,new.item_type); return new; end $$;
create trigger clean_saved before insert or update on public.saved_items for each row execute function public.clean_saved_write();

-- Shared per-user transaction lock serializes preference edits/imports/issue numbers.
create function public.set_library_preferences(prefs jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); item jsonb; idx integer:=0;
begin
 if owner is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 insert into public.profiles(id) values(owner) on conflict do nothing;
 delete from public.user_sources where user_id=owner;
 if prefs is null or prefs='null'::jsonb then delete from public.user_preferences where user_id=owner; return; end if;
 if prefs->>'version' <> '1' or jsonb_array_length(prefs->'interests') < 3 then raise exception 'Invalid preferences'; end if;
 insert into public.user_preferences(user_id,version,interests) values(owner,1,array(select jsonb_array_elements_text(prefs->'interests')))
 on conflict(user_id) do update set interests=excluded.interests,updated_at=now();
 for item in select jsonb_array_elements(prefs->'sources') loop
  insert into public.user_sources values(owner,item#>>'{}','curated',null,idx) on conflict do nothing; idx:=idx+1;
 end loop;
 for item in select jsonb_array_elements(prefs->'customSources') loop
  insert into public.user_sources values(owner,item->>'id','custom',
   (select jsonb_object_agg(key,val) from jsonb_each(item) as x(key,val) where key=any(array['id','name','slug','websiteUrl','feedUrl','sourceType','categories'])),idx) on conflict do nothing; idx:=idx+1;
 end loop;
end $$;
create function public.merge_guest_library(prefs jsonb, entries jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); item jsonb; existing public.user_preferences; merged jsonb; customs jsonb; curated jsonb;
begin
 if owner is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 -- Merge against current database data inside the lock, never a stale browser snapshot.
 select * into existing from public.user_preferences where user_id=owner;
 if prefs is not null and prefs<>'null'::jsonb then
  select coalesce(jsonb_agg(metadata order by position),'[]') into customs from public.user_sources where user_id=owner and kind='custom';
  select coalesce(jsonb_agg(source_id order by position),'[]') into curated from public.user_sources where user_id=owner and kind='curated';
  merged:=jsonb_build_object('version',1,
   'interests',(select jsonb_agg(distinct v) from jsonb_array_elements(coalesce(to_jsonb(existing.interests),'[]') || (prefs->'interests')) as t(v)),
   'sources',(select jsonb_agg(distinct v) from jsonb_array_elements(curated || (prefs->'sources')) as t(v)),
   'customSources',(select coalesce(jsonb_agg(v),'[]') from (select distinct on (coalesce(v->>'feedUrl',v->>'websiteUrl')) v from jsonb_array_elements(customs || (prefs->'customSources')) with ordinality as t(v,n) order by coalesce(v->>'feedUrl',v->>'websiteUrl'),n) s));
  if jsonb_array_length(merged->'customSources')>8 then raise exception 'Combined custom feeds exceed eight'; end if;
  merged:=jsonb_set(merged,'{sources}',coalesce(merged->'sources','[]'));
  perform public.set_library_preferences(merged);
 end if;
 for item in select jsonb_array_elements(entries) loop
  insert into public.saved_items(user_id,item_key,item_type,snapshot,saved_at) values(owner,item->>'key',item->>'kind',public.clean_snapshot(item->'item',item->>'kind'),(item->>'savedAt')::timestamptz) on conflict do nothing;
 end loop;
end $$;
create function public.create_magazine_issue(period date, preferences jsonb, composition jsonb, entries jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); issue uuid; next_number integer; item jsonb;
begin
 if owner is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 select id into issue from public.magazine_issues where user_id=owner and issue_date=period;
 if issue is not null then return issue; end if;
 select coalesce(max(issue_number),0)+1 into next_number from public.magazine_issues where user_id=owner;
 insert into public.magazine_issues(user_id,issue_number,issue_date,preferences_snapshot,composition)
 values(owner,next_number,period,
  (select coalesce(jsonb_object_agg(key,val),'{}') from jsonb_each(preferences) as x(key,val) where key=any(array['version','interests','sources','customSources'])),
  (select coalesce(jsonb_object_agg(key,val),'{}') from jsonb_each(composition) as x(key,val) where key=any(array['sections','fallback','partial','loadedCount']))) returning id into issue;
 for item in select jsonb_array_elements(entries) loop
  insert into public.magazine_issue_items values(issue,(item->>'position')::integer,item->>'type',item->>'section',item->>'sourceId',item->>'externalId',item->>'originalUrl',public.clean_snapshot(item->'snapshot',item->>'type'));
 end loop;
 return issue;
end $$;
-- Functions default to PUBLIC execute in PostgreSQL: explicitly revoke it.
revoke all on function public.set_library_preferences(jsonb),public.merge_guest_library(jsonb,jsonb),public.create_magazine_issue(date,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.set_library_preferences(jsonb),public.merge_guest_library(jsonb,jsonb),public.create_magazine_issue(date,jsonb,jsonb,jsonb) to authenticated;
