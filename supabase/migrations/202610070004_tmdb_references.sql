-- TMDB historical selections retain identity; metadata is resolved through its bounded cache.
create or replace function public.clean_snapshot(value jsonb,kind text) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb; provider text; pid text; canonical_id text; destination text;
begin
 if kind not in ('film','tv','book','album') then return public.clean_snapshot_v1(value,kind); end if;
 provider:=case when kind in ('film','tv') then 'tmdb' when kind='book' then 'openlibrary' else 'musicbrainz' end;
 pid:=value->>'providerId';
 canonical_id:=case when kind='film' then 'tmdb:movie:' when kind='tv' then 'tmdb:tv:' else provider||':' end||pid;
 destination:=case when kind='film' then 'https://www.themoviedb.org/movie/' when kind='tv' then 'https://www.themoviedb.org/tv/' when kind='book' then 'https://openlibrary.org/works/' else 'https://musicbrainz.org/release-group/' end||pid;
 if value->>'kind' is distinct from 'cultural-pick' or value->>'mediaType' is distinct from kind or value->>'contentPolicy' is distinct from 'reusable' or value->'source'->>'id' is distinct from provider or ((provider<>'tmdb' or coalesce(value->>'pointerOnly','false')<>'true') and value->'provenance'->>'provider' is distinct from provider) or value->>'id' is distinct from canonical_id or value->>'originalUrl' is distinct from destination or value->>'internalUrl' is distinct from '/explore/'||kind||'/'||pid then raise exception 'Invalid cultural pick provenance'; end if;
 if kind in ('film','tv') and pid!~'^[1-9][0-9]*$' then raise exception 'Invalid TMDB identity'; end if;
 if kind='book' and pid!~'^OL[1-9][0-9]*W$' then raise exception 'Invalid work identity'; end if;
 if provider='tmdb' then
   -- Immutable identity/reference only. Provider metadata/posters are hydrated
   -- through the 24-hour cache; never persisted indefinitely as application data.
   return jsonb_build_object('id',canonical_id,'kind','cultural-pick','mediaType',kind,'providerId',pid::integer,'contentPolicy','reusable','originalUrl',destination,'internalUrl','/explore/'||kind||'/'||pid,'source',jsonb_build_object('id','tmdb','name','TMDB','sourceType','api','websiteUrl','https://www.themoviedb.org'),'pointerOnly',true);
 end if;
 if kind='album' and (pid!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or value->>'primaryType' is distinct from 'Album' or value ? 'image') then raise exception 'Albums are metadata only'; end if;
 if value ? 'image' and ((provider='tmdb' and value->'image'->>'src' !~ '^https://image[.]tmdb[.]org/t/p/w500/[A-Za-z0-9._-]+$') or (provider='openlibrary' and value->'image'->>'src' !~ '^https://covers[.]openlibrary[.]org/b/id/[1-9][0-9]*-L[.]jpg([?]default=false)?$')) then raise exception 'Invalid cultural image source'; end if;
 if provider='tmdb' and ((value->'provenance'->>'expiresAt')::timestamptz is null or (value->'provenance'->>'expiresAt')::timestamptz>(value->'provenance'->>'fetchedAt')::timestamptz+interval '151 days') then raise exception 'TMDB retention is bounded'; end if;
 select coalesce(jsonb_object_agg(key,val),'{}') into result from jsonb_each(value) x(key,val) where key=any(array['id','kind','mediaType','providerId','title','image','creators','artist','year','topics','interestIds','contentPolicy','originalUrl','internalUrl','attribution','provenance','coverId','primaryType']);
 return result||jsonb_build_object('source',(select jsonb_object_agg(key,val) from jsonb_each(value->'source') x(key,val) where key=any(array['id','name','slug','websiteUrl','sourceType','categories'])));
end $$;

grant execute on function public.clean_snapshot(jsonb,text) to authenticated;
