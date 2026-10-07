-- Apply after 202610060001_library.sql. Append-only current-period revisions.
create table public.magazine_issue_revisions (
 issue_id uuid not null references public.magazine_issues(id) on delete cascade,
 revision_number integer not null check(revision_number>0),
 section_id text not null,
 created_at timestamptz not null default now(),
 composition jsonb not null,
 entries jsonb not null check(jsonb_typeof(entries)='array'),
 primary key(issue_id,revision_number)
);
alter table public.magazine_issue_revisions enable row level security;
create policy revisions_read_owner on public.magazine_issue_revisions for select to authenticated using(exists(select 1 from public.magazine_issues i where i.id=issue_id and i.user_id=(select auth.uid())));
revoke all on public.magazine_issue_revisions from public,anon,authenticated;
grant select on public.magazine_issue_revisions to authenticated;
create function public.revise_magazine_issue(target uuid, expected integer, section text, composition jsonb, entries jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); original public.magazine_issues; previous public.magazine_issue_revisions; base_composition jsonb; base_entries jsonb; cleaned jsonb; current_revision integer:=0; n integer; old_section jsonb; new_section jsonb;
begin
 if owner is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 select * into original from public.magazine_issues where id=target and user_id=owner;
 if original.id is null then raise exception 'Issue unavailable'; end if;
 if original.issue_date <> (now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Archived issues cannot be revised'; end if;
 if section in ('lead','on-this-day') or length(section)>80 then raise exception 'Section cannot be refreshed'; end if;
 select * into previous from public.magazine_issue_revisions where issue_id=target order by revision_number desc limit 1;
 if previous.issue_id is not null then
  current_revision:=previous.revision_number; base_composition:=previous.composition; base_entries:=previous.entries;
 else
  base_composition:=original.composition;
  select coalesce(jsonb_agg(jsonb_build_object('position',position,'type',item_type,'section',magazine_issue_items.section,'sourceId',source_id,'externalId',external_id,'originalUrl',original_url,'snapshot',snapshot) order by position),'[]') into base_entries from public.magazine_issue_items where issue_id=target;
 end if;
 if expected is null or expected<>current_revision then raise exception 'Issue changed; reload before refreshing'; end if;
 if current_revision>=100 then raise exception 'Enough selections for this issue'; end if;
 if jsonb_array_length(entries)<>jsonb_array_length(base_entries) or jsonb_array_length(entries)>30 then raise exception 'Issue size must stay stable'; end if;
 if composition-'sections' is distinct from base_composition-'sections' then raise exception 'Issue metadata cannot change'; end if;
 if (select coalesce(jsonb_agg(v),'[]') from jsonb_array_elements(composition->'sections') v where v->>'id'<>section) is distinct from (select coalesce(jsonb_agg(v),'[]') from jsonb_array_elements(base_composition->'sections') v where v->>'id'<>section) then raise exception 'Other sections cannot change'; end if;
 select v into old_section from jsonb_array_elements(base_composition->'sections') v where v->>'id'=section;
 select v into new_section from jsonb_array_elements(composition->'sections') v where v->>'id'=section;
 if old_section-'storyIds' is distinct from new_section-'storyIds' then raise exception 'Section metadata cannot change'; end if;
 if old_section is not null and jsonb_array_length(old_section->'storyIds')<>jsonb_array_length(new_section->'storyIds') then raise exception 'Section size cannot change'; end if;
 select count(*) into n from jsonb_array_elements(base_entries) v where v->>'section'=section;
 if n=0 or n<>(select count(*) from jsonb_array_elements(entries) v where v->>'section'=section) then raise exception 'Invalid replacement section'; end if;
 select jsonb_agg(v || jsonb_build_object('snapshot',public.clean_snapshot(v->'snapshot',v->>'type')) order by (v->>'position')::integer) into cleaned from jsonb_array_elements(entries) v;
 if (select coalesce(jsonb_agg(v-'position' order by (v->>'position')::integer),'[]') from jsonb_array_elements(cleaned) v where v->>'section'<>section) is distinct from (select coalesce(jsonb_agg(v-'position' order by (v->>'position')::integer),'[]') from jsonb_array_elements(base_entries) v where v->>'section'<>section) then raise exception 'Other discoveries cannot change'; end if;
 if exists(select 1 from jsonb_array_elements(cleaned) v where v->>'section'=section and exists(select 1 from jsonb_array_elements(base_entries) b where b->>'type'=v->>'type' and b->>'externalId'=v->>'externalId')) then raise exception 'Choose a different discovery'; end if;
 if exists(select 1 from jsonb_array_elements(cleaned) v where v->>'section'=section and ((section='rabbit-hole' and v->>'type'<>'wikipediaDiscovery') or (section='artwork' and v->>'type'<>'artwork') or (section not in ('rabbit-hole','artwork') and v->>'type'<>'externalArticle'))) then raise exception 'Invalid replacement kind'; end if;
 if previous.created_at>now()-interval '2 seconds' then raise exception 'Please wait before another selection'; end if;
 insert into public.magazine_issue_revisions values(target,current_revision+1,section,now(),composition,cleaned);
 return current_revision+1;
end $$;
-- Only identifiers from five prior final issues. No Saved or full Archive reads.
create function public.recent_magazine_items(before_date date) returns table(item_type text,external_id text,original_url text)
language sql stable security definer set search_path='' as $$
 with recent as (select id from public.magazine_issues where user_id=auth.uid() and issue_date<before_date order by issue_date desc limit 5),
 latest as (select r.id, rev.entries from recent r left join lateral(select entries from public.magazine_issue_revisions where issue_id=r.id order by revision_number desc limit 1)rev on true)
 select v->>'type',v->>'externalId',v->>'originalUrl' from latest l cross join lateral jsonb_array_elements(l.entries)v
 union all select i.item_type,i.external_id,i.original_url from latest l join public.magazine_issue_items i on i.issue_id=l.id where l.entries is null;
$$;
revoke all on function public.revise_magazine_issue(uuid,integer,text,jsonb,jsonb),public.recent_magazine_items(date) from public,anon;
grant execute on function public.revise_magazine_issue(uuid,integer,text,jsonb,jsonb),public.recent_magazine_items(date) to authenticated;
