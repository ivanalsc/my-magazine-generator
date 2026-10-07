-- Extend generalized library snapshots; no new per-media library tables.
alter table public.saved_items drop constraint saved_items_item_type_check;
alter table public.saved_items add constraint saved_items_item_type_check check(item_type in ('externalArticle','wikipediaDiscovery','artwork','legacyCultural','film','tv','book','album'));
alter table public.magazine_issue_items drop constraint magazine_issue_items_item_type_check;
alter table public.magazine_issue_items add constraint magazine_issue_items_item_type_check check(item_type in ('externalArticle','wikipediaDiscovery','artwork','legacyCultural','history','film','tv','book','album'));
alter function public.clean_snapshot(jsonb,text) rename to clean_snapshot_v1;
create function public.clean_snapshot(value jsonb,kind text) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb; provider text; pid text; canonical_id text; destination text;
begin
 if kind not in ('film','tv','book','album') then return public.clean_snapshot_v1(value,kind); end if;
 provider:=case when kind in ('film','tv') then 'tmdb' when kind='book' then 'openlibrary' else 'musicbrainz' end;
 pid:=value->>'providerId';
 canonical_id:=case when kind='film' then 'tmdb:movie:' when kind='tv' then 'tmdb:tv:' else provider||':' end||pid;
 destination:=case when kind='film' then 'https://www.themoviedb.org/movie/' when kind='tv' then 'https://www.themoviedb.org/tv/' when kind='book' then 'https://openlibrary.org/works/' else 'https://musicbrainz.org/release-group/' end||pid;
 if value->>'kind' is distinct from 'cultural-pick' or value->>'mediaType' is distinct from kind or value->>'contentPolicy' is distinct from 'reusable' or value->'source'->>'id' is distinct from provider or value->'provenance'->>'provider' is distinct from provider or value->>'id' is distinct from canonical_id or value->>'originalUrl' is distinct from destination or value->>'internalUrl' is distinct from '/explore/'||kind||'/'||pid then raise exception 'Invalid cultural pick provenance'; end if;
 if kind in ('film','tv') and pid!~'^[1-9][0-9]*$' then raise exception 'Invalid TMDB identity'; end if;
 if kind='book' and pid!~'^OL[1-9][0-9]*W$' then raise exception 'Invalid work identity'; end if;
 if kind='album' and (pid!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or value->>'primaryType' is distinct from 'Album' or value ? 'image') then raise exception 'Albums are metadata only'; end if;
 if value ? 'image' and ((provider='tmdb' and value->'image'->>'src' !~ '^https://image[.]tmdb[.]org/t/p/w500/[A-Za-z0-9._-]+$') or (provider='openlibrary' and value->'image'->>'src' !~ '^https://covers[.]openlibrary[.]org/b/id/[1-9][0-9]*-L[.]jpg([?]default=false)?$')) then raise exception 'Invalid cultural image source'; end if;
 if provider='tmdb' and ((value->'provenance'->>'expiresAt')::timestamptz is null or (value->'provenance'->>'expiresAt')::timestamptz>(value->'provenance'->>'fetchedAt')::timestamptz+interval '151 days') then raise exception 'TMDB retention is bounded'; end if;
 select coalesce(jsonb_object_agg(key,val),'{}') into result from jsonb_each(value) x(key,val) where key=any(array['id','kind','mediaType','providerId','title','image','creators','artist','year','topics','interestIds','contentPolicy','originalUrl','internalUrl','attribution','provenance','coverId','primaryType']);
 return result||jsonb_build_object('source',(select jsonb_object_agg(key,val) from jsonb_each(value->'source') x(key,val) where key=any(array['id','name','slug','websiteUrl','sourceType','categories'])));
end $$;
revoke all on function public.clean_snapshot(jsonb,text),public.clean_snapshot_v1(jsonb,text) from public,anon;
grant execute on function public.clean_snapshot(jsonb,text),public.clean_snapshot_v1(jsonb,text) to authenticated;
-- Retire the obsolete guest Saved import. Preference RPC remains available.
revoke execute on function public.merge_guest_library(jsonb,jsonb) from authenticated;
-- Globally shared reservation queue protects MusicBrainz across app workers.
create table public.cultural_provider_limits(provider text primary key,next_request timestamptz not null);
alter table public.cultural_provider_limits enable row level security;
revoke all on public.cultural_provider_limits from public,anon,authenticated;
create function public.reserve_musicbrainz_request() returns integer language plpgsql security definer set search_path='' as $$
declare slot timestamptz; delay integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('my-magazine:musicbrainz',0));
 select greatest(next_request,clock_timestamp()) into slot from public.cultural_provider_limits where provider='musicbrainz';
 slot:=coalesce(slot,clock_timestamp());
 delay:=greatest(0,ceil(extract(epoch from slot-clock_timestamp())*1000)::integer);
 if delay>5000 then return -1; end if;
 insert into public.cultural_provider_limits values('musicbrainz',slot+interval '1100 milliseconds') on conflict(provider) do update set next_request=excluded.next_request;
 return delay;
end $$;
revoke all on function public.reserve_musicbrainz_request() from public;
grant execute on function public.reserve_musicbrainz_request() to anon,authenticated;
create or replace function public.revise_magazine_issue(target uuid, expected integer, section text, composition jsonb, entries jsonb) returns integer
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
 if exists(select 1 from jsonb_array_elements(cleaned) v where v->>'section'=section and ((section='rabbit-hole' and v->>'type'<>'wikipediaDiscovery') or (section='artwork' and v->>'type'<>'artwork') or (section='cultural-pick' and v->>'type' not in ('film','tv','book','album')) or (section not in ('rabbit-hole','artwork','cultural-pick') and v->>'type'<>'externalArticle'))) then raise exception 'Invalid replacement kind'; end if;
 if previous.created_at>now()-interval '2 seconds' then raise exception 'Please wait before another selection'; end if;
 insert into public.magazine_issue_revisions values(target,current_revision+1,section,now(),composition,cleaned);
 return current_revision+1;
end $$;
