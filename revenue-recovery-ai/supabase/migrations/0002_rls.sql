-- Row Level Security. Treat this file as the tenant isolation boundary.
--
-- Every helper is SECURITY DEFINER so it reads business_members with RLS
-- bypassed. Without that, a policy on business_members that queries
-- business_members recurses infinitely and Postgres aborts the query.

-- --------------------------------------------------------------- helpers ----
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_super_admin from public.users where id = auth.uid()), false);
$$;

create or replace function public.is_member_of(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = bid and user_id = auth.uid()
  ) or public.is_super_admin();
$$;

-- Owner/admin may change configuration; staff is read + lead-work only.
create or replace function public.can_admin(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = bid and user_id = auth.uid() and role in ('owner','admin')
  ) or public.is_super_admin();
$$;

-- ------------------------------------------------------------ enable RLS ----
alter table users                 enable row level security;
alter table businesses            enable row level security;
alter table business_members      enable row level security;
alter table business_services     enable row level security;
alter table business_faqs         enable row level security;
alter table leads                 enable row level security;
alter table conversations         enable row level security;
alter table messages              enable row level security;
alter table calls                 enable row level security;
alter table appointments          enable row level security;
alter table appointment_blackouts enable row level security;
alter table revenue_events        enable row level security;
alter table ai_actions            enable row level security;
alter table subscriptions         enable row level security;
alter table usage_events          enable row level security;
alter table phone_numbers         enable row level security;
alter table prospects             enable row level security;
alter table audit_logs            enable row level security;

-- ---------------------------------------------------------------- users ----
create policy users_self_select on users for select
  using (id = auth.uid() or public.is_super_admin());
create policy users_self_update on users for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ----------------------------------------------------------- businesses ----
create policy businesses_select on businesses for select
  using (public.is_member_of(id));
-- A signed-in user may create a business, but only owned by themselves.
create policy businesses_insert on businesses for insert
  with check (owner_id = auth.uid());
create policy businesses_update on businesses for update
  using (public.can_admin(id)) with check (public.can_admin(id));
create policy businesses_delete on businesses for delete
  using (owner_id = auth.uid() or public.is_super_admin());

create policy members_select on business_members for select
  using (public.is_member_of(business_id));
create policy members_write on business_members for all
  using (public.can_admin(business_id)) with check (public.can_admin(business_id));

-- Configuration tables: read for members, write for owner/admin.
create policy services_select on business_services for select using (public.is_member_of(business_id));
create policy services_write  on business_services for all    using (public.can_admin(business_id)) with check (public.can_admin(business_id));
create policy faqs_select     on business_faqs     for select using (public.is_member_of(business_id));
create policy faqs_write      on business_faqs     for all    using (public.can_admin(business_id)) with check (public.can_admin(business_id));
create policy blackouts_select on appointment_blackouts for select using (public.is_member_of(business_id));
create policy blackouts_write  on appointment_blackouts for all    using (public.can_admin(business_id)) with check (public.can_admin(business_id));
create policy phones_select    on phone_numbers for select using (public.is_member_of(business_id));
create policy phones_write     on phone_numbers for all    using (public.can_admin(business_id)) with check (public.can_admin(business_id));

-- Operational tables: any member may read and work them.
create policy leads_select on leads for select using (public.is_member_of(business_id));
create policy leads_write  on leads for all    using (public.is_member_of(business_id)) with check (public.is_member_of(business_id));
create policy conversations_select on conversations for select using (public.is_member_of(business_id));
create policy conversations_write  on conversations for all    using (public.is_member_of(business_id)) with check (public.is_member_of(business_id));
create policy messages_select on messages for select using (public.is_member_of(business_id));
create policy messages_write  on messages for all    using (public.is_member_of(business_id)) with check (public.is_member_of(business_id));
create policy calls_select on calls for select using (public.is_member_of(business_id));
create policy calls_write  on calls for all    using (public.is_member_of(business_id)) with check (public.is_member_of(business_id));
create policy appointments_select on appointments for select using (public.is_member_of(business_id));
create policy appointments_write  on appointments for all    using (public.is_member_of(business_id)) with check (public.is_member_of(business_id));
create policy revenue_select on revenue_events for select using (public.is_member_of(business_id));
create policy revenue_write  on revenue_events for all    using (public.is_member_of(business_id)) with check (public.is_member_of(business_id));
create policy prospects_select on prospects for select using (public.is_member_of(business_id));
create policy prospects_write  on prospects for all    using (public.is_member_of(business_id)) with check (public.is_member_of(business_id));

-- Audit-style tables are read-only to tenants. Only the service role writes
-- them, so a compromised browser session cannot forge or erase history.
create policy ai_actions_select on ai_actions   for select using (public.is_member_of(business_id));
create policy usage_select     on usage_events  for select using (public.is_member_of(business_id));
create policy audit_select     on audit_logs    for select using (public.is_member_of(business_id));

-- Billing state is written only by the verified Stripe webhook (service role).
create policy subscriptions_select on subscriptions for select using (public.is_member_of(business_id));
