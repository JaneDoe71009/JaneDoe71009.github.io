-- IB Info: run once in the SQL editor of your own Supabase project.
-- Personal plans and identities are never included in the public content response.
begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table private.site_owner (singleton boolean primary key default true check(singleton),user_id uuid unique not null references auth.users(id));
create table private.admins (user_id uuid primary key references auth.users(id),created_at timestamptz not null default now());
create table private.bans (user_id uuid primary key references auth.users(id),reason text not null,created_at timestamptz not null default now());
create table public.content (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('resource','deadline','event','correction','tip','thread','reply')),
 title text not null check(length(title) between 1 and 160),
 body text not null default '' check(length(body)<=10000),
 subject text not null default 'General' check(length(subject)<=120),
 category text not null default 'General' check(length(category)<=80),
 url text not null default '' check(length(url)<=2000 and (url='' or url ~ '^https?://')),
 event_date date, end_date date,
 parent_id uuid references public.content(id), target_id uuid references public.content(id),
 display_name text not null default 'Anonymous' check(length(display_name) between 1 and 40),
 status text not null check(status in ('pending','approved','rejected','hidden')),
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 check(end_date is null or (event_date is not null and end_date>=event_date)),
 check(kind not in ('deadline','event') or event_date is not null),
 check(event_date is null or event_date between date '2000-01-01' and date '2100-12-31'),
 check(end_date is null or end_date between date '2000-01-01' and date '2100-12-31')
);
create index content_feed on public.content(status,kind,created_at desc);
create table private.authorship (content_id uuid primary key references public.content(id) on delete cascade,user_id uuid not null references auth.users(id),created_at timestamptz not null default now());
create index authorship_rate on private.authorship(user_id,created_at desc);
create table public.personal_plans (user_id uuid primary key references auth.users(id) on delete cascade,data jsonb not null default '{}',updated_at timestamptz default now(),check(jsonb_typeof(data)='object' and octet_length(data::text)<=200000));
create table public.reports (id uuid primary key default gen_random_uuid(),content_id uuid not null references public.content(id),reason text not null check(length(reason) between 3 and 2000),status text not null default 'open' check(status in ('open','resolved')),created_at timestamptz not null default now());
create table private.report_authors (report_id uuid primary key references public.reports(id) on delete cascade,user_id uuid not null references auth.users(id));
create table private.audit (id bigint generated always as identity primary key,actor uuid,action text not null,target text,created_at timestamptz not null default now());
create table private.blocked_terms (term text primary key);
insert into private.blocked_terms values ('fuck'),('shit'),('bitch'),('nigger'),('faggot'),('cunt');
create function private.is_owner() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.site_owner where user_id=auth.uid());
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select private.is_owner() or exists(select 1 from private.admins where user_id=auth.uid());
$$;
create function private.check_member() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to contribute.'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verify your email before contributing.'; end if;
 if exists(select 1 from private.bans where user_id=auth.uid()) then raise exception 'Posting is disabled for this account. Contact the site owner.'; end if;
end;$$;
create function private.check_text(value text) returns void language plpgsql security definer set search_path='' as $$
declare t text; normalized text;
begin
 normalized:=lower(translate(value,'013@$!','oieasi'));
 for t in select term from private.blocked_terms loop
  if normalized ~ ('\m'||t||'(s|ing|ed)?\M') then raise exception 'Please remove explicit or hateful language before posting.'; end if;
 end loop;
end;$$;
create function public.my_role() returns text language sql stable security definer set search_path='' as $$
 select case when private.is_owner() then 'owner' when private.is_admin() then 'admin' else 'student' end;
$$;
create function public.submit_content(p jsonb) returns public.content language plpgsql security definer set search_path='' as $$
declare row public.content; k text; c integer; parent public.content;
begin
 perform private.check_member();
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 select count(*) into c from private.authorship where user_id=auth.uid() and created_at>now()-interval '1 hour';
 if c>=20 then raise exception 'You have reached the hourly posting limit. Please try again later.'; end if;
 k:=p->>'kind';
 if k not in ('resource','deadline','event','correction','tip','thread','reply') or k is null then raise exception 'Choose a valid submission type.'; end if;
 perform private.check_text(concat_ws(' ',p->>'title',p->>'body',p->>'display_name',p->>'subject',p->>'category'));
 if k='resource' and coalesce(p->>'url','')!~'^https?://' then raise exception 'Resources need an http or https link.'; end if;
 if k in ('tip','thread','reply') and length(trim(coalesce(p->>'body','')))<3 then raise exception 'Add some text before posting.'; end if;
 if k='reply' then
  select * into parent from public.content where id=(p->>'parent_id')::uuid and kind='thread' and status='approved' for share;
  if parent.id is null then raise exception 'That discussion is not available.'; end if;
 end if;
 if k='correction' then
  if not exists(select 1 from public.content where id=(p->>'target_id')::uuid and status='approved' and kind in ('resource','deadline','event')) then raise exception 'Choose an approved shared item to correct.'; end if;
 end if;
 insert into public.content(kind,title,body,subject,category,url,event_date,end_date,parent_id,target_id,display_name,status)
 values(k,trim(p->>'title'),trim(coalesce(p->>'body','')),coalesce(p->>'subject','General'),coalesce(p->>'category','General'),coalesce(p->>'url',''),nullif(p->>'event_date','')::date,nullif(p->>'end_date','')::date,case when k='reply' then (p->>'parent_id')::uuid end,case when k='correction' then (p->>'target_id')::uuid end,coalesce(nullif(trim(p->>'display_name'),''),'Anonymous'),case when k in ('tip','thread','reply') then 'approved' else 'pending' end) returning * into row;
 insert into private.authorship(content_id,user_id) values(row.id,auth.uid());
 return row;
end;$$;
create function public.my_submissions() returns setof public.content language sql stable security definer set search_path='' as $$
 select c.* from public.content c join private.authorship a on a.content_id=c.id where a.user_id=auth.uid() order by c.created_at desc limit 100;
$$;
create function public.review_content(item_id uuid,decision text) returns void language plpgsql security definer set search_path='' as $$
declare item public.content; target public.content;
begin
 if not private.is_admin() then raise exception 'Administrator access required.'; end if;
 if decision not in ('approved','rejected','hidden') then raise exception 'Invalid review decision.'; end if;
 select * into item from public.content where id=item_id for update;
 if item.id is null then raise exception 'Item not found.'; end if;
 if item.status!='pending' and decision!='hidden' then raise exception 'This submission was already reviewed.'; end if;
 if item.kind='correction' and decision='approved' then
  select * into target from public.content where id=item.target_id and status='approved' for update;
  if target.id is null then raise exception 'The original item is no longer published.'; end if;
  if target.kind in ('deadline','event') and item.event_date is null then raise exception 'A corrected calendar entry needs a date.'; end if;
  if target.kind='resource' and item.url!~'^https?://' then raise exception 'A corrected resource needs an http or https link.'; end if;
  update public.content set title=item.title,body=item.body,url=item.url,subject=item.subject,event_date=item.event_date,end_date=item.end_date,revision=revision+1 where id=target.id;
 end if;
 update public.content set status=decision where id=item_id;
 if decision='hidden' and item.kind='thread' then update public.content set status='hidden' where parent_id=item_id; end if;
 insert into private.audit(actor,action,target) values(auth.uid(),'review:'||decision,item_id::text);
end;$$;
create function public.report_content(item_id uuid,report_reason text) returns void language plpgsql security definer set search_path='' as $$
declare report_id uuid;
begin
 perform private.check_member();
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if length(trim(report_reason))<3 then raise exception 'Please explain the report.'; end if;
 if not exists(select 1 from public.content where id=item_id and status='approved') then raise exception 'This post is no longer available.'; end if;
 if (select count(*) from private.report_authors a join public.reports r on r.id=a.report_id where a.user_id=auth.uid() and r.created_at>now()-interval '1 hour')>=10 then raise exception 'Please wait before sending more reports.'; end if;
 insert into public.reports(content_id,reason) values(item_id,trim(report_reason)) returning id into report_id;
 insert into private.report_authors values(report_id,auth.uid());
end;$$;
create function public.owner_identity(item_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_owner() then raise exception 'Only the site owner can access identities.'; end if;
 select jsonb_build_object('user_id',u.id,'email',u.email) into result from private.authorship a join auth.users u on u.id=a.user_id where a.content_id=item_id;
 insert into private.audit(actor,action,target) values(auth.uid(),'identity_lookup',item_id::text);
 return result;
end;$$;
create function public.owner_admins() returns table(user_id uuid,email text) language plpgsql security definer set search_path='' as $$
begin
 if not private.is_owner() then raise exception 'Owner access required.'; end if;
 return query select a.user_id,u.email::text from private.admins a join auth.users u on u.id=a.user_id;
end;$$;
create function public.owner_set_admin(member_email text,make_admin boolean) returns void language plpgsql security definer set search_path='' as $$
declare member_id uuid;
begin
 if not private.is_owner() then raise exception 'Owner access required.'; end if;
 select id into member_id from auth.users where lower(email)=lower(trim(member_email)) and email_confirmed_at is not null;
 if member_id is null then raise exception 'That student must sign in and verify their email first.'; end if;
 if member_id=auth.uid() then raise exception 'Your owner role is managed separately.'; end if;
 if make_admin then insert into private.admins(user_id) values(member_id) on conflict do nothing;
 else delete from private.admins where user_id=member_id; end if;
 insert into private.audit(actor,action,target) values(auth.uid(),'admin:'||make_admin::text,member_id::text);
end;$$;
create function public.owner_resolve_report(report_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_owner() then raise exception 'Owner access required.'; end if;
 update public.reports set status='resolved' where id=report_id;
end;$$;
create function public.owner_ban_author(item_id uuid,ban_reason text) returns void language plpgsql security definer set search_path='' as $$
declare member_id uuid;
begin
 if not private.is_owner() then raise exception 'Owner access required.'; end if;
 select user_id into member_id from private.authorship where content_id=item_id;
 if member_id is null or member_id=auth.uid() then raise exception 'This account cannot be restricted.'; end if;
 insert into private.bans(user_id,reason) values(member_id,ban_reason) on conflict(user_id) do update set reason=excluded.reason;
 insert into private.audit(actor,action,target) values(auth.uid(),'posting_restricted',member_id::text);
end;$$;
-- Bootstrap is deliberately SQL-editor-only. The first visitor never becomes owner.
create function public.configure_owner(owner_email text) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 select id into target from auth.users where lower(email)=lower(trim(owner_email)) and email_confirmed_at is not null;
 if target is null then raise exception 'The owner must sign in and verify their email first.'; end if;
 insert into private.site_owner(singleton,user_id) values(true,target);
end;$$;
alter table public.content enable row level security;
alter table public.personal_plans enable row level security;
alter table public.reports enable row level security;
revoke all on public.content,public.personal_plans,public.reports from anon,authenticated;
grant select on public.content to anon,authenticated;
grant select,insert,update,delete on public.personal_plans to authenticated;
grant select on public.reports to authenticated;
grant usage on schema private to authenticated;
-- Private tables remain ungranted; only the narrowly scoped helper functions are executable.
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_owner(),private.is_admin() to authenticated;
create policy content_public_read on public.content for select using(status='approved');
create policy content_admin_read on public.content for select to authenticated using(private.is_admin());
create policy plans_read on public.personal_plans for select to authenticated using(user_id=auth.uid());
create policy plans_create on public.personal_plans for insert to authenticated with check(user_id=auth.uid());
create policy plans_update on public.personal_plans for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy plans_delete on public.personal_plans for delete to authenticated using(user_id=auth.uid());
create policy reports_owner_read on public.reports for select to authenticated using(private.is_owner());
revoke all on function public.configure_owner(text) from public,anon,authenticated;
revoke all on function public.my_role(),public.submit_content(jsonb),public.my_submissions(),public.review_content(uuid,text),public.report_content(uuid,text),public.owner_identity(uuid),public.owner_admins(),public.owner_set_admin(text,boolean),public.owner_resolve_report(uuid),public.owner_ban_author(uuid,text) from public,anon,authenticated;
grant execute on function public.my_role(),public.submit_content(jsonb),public.my_submissions(),public.review_content(uuid,text),public.report_content(uuid,text),public.owner_identity(uuid),public.owner_admins(),public.owner_set_admin(text,boolean),public.owner_resolve_report(uuid),public.owner_ban_author(uuid,text) to authenticated;
commit;
