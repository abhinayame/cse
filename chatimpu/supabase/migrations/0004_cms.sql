-- CMS support: staff-facing view, missing write policies, app settings ──────────

-- Without an image CDN configured, return the storage path unchanged. Clients turn a
-- bare path into `${SUPABASE_URL}/storage/v1/object/public/media/<path>` (the old
-- fallback produced a relative URL that only worked on the Supabase domain).
create or replace function image_url(path text, w int default 900) returns text language sql stable as $$
  select case
    when path ~ '^https?://' then path
    when nullif(current_setting('app.image_cdn', true), '') is null then path
    else current_setting('app.image_cdn', true) || '/' || path || '?width=' || w || '&format=webp&quality=78'
  end
$$;

-- Every story the caller may see (RLS applies: staff see drafts and scheduled stories),
-- in the app's Story shape plus the newsroom fields.
create or replace view cms_stories with (security_invoker = true) as
  select s.id, s.district_id, s.status, s.updated_at,
    story_json(s) || jsonb_build_object(
      'status', s.status,
      'publishAt', s.publish_at,
      'pushOnPublish', s.push_on_publish,
      'imagePath', s.image_path,
      'author', coalesce(p.display_name, p.phone, ''),
      'publishedAt', coalesce(s.published_at, s.created_at)
    ) as doc
  from stories s left join profiles p on p.id = s.author_id;

-- Moderator districts had RLS enabled but no policies, so nobody could read or assign them.
create policy staff_read on moderator_districts for select using (is_staff());
create policy admin_write on moderator_districts for all using (my_role() = 'super_admin') with check (my_role() = 'super_admin');

-- Poll children were read-only; editors create polls from the CMS.
create policy staff_write on poll_questions for all using (my_role() in ('super_admin','editor')) with check (my_role() in ('super_admin','editor'));
create policy staff_write on poll_options for all using (my_role() in ('super_admin','editor')) with check (my_role() in ('super_admin','editor'));
create policy staff_write on poll_option_labels for all using (my_role() in ('super_admin','editor')) with check (my_role() in ('super_admin','editor'));

-- Advertisers: staff can read names for the ad list (writes stay super_admin only).
create policy staff_read on advertisers for select using (is_staff());

-- Small key/value settings read by the app (e.g. how often native ads appear).
create table if not exists app_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
alter table app_settings enable row level security;
create policy read_all on app_settings for select using (true);
create policy admin_write on app_settings for all using (my_role() = 'super_admin') with check (my_role() = 'super_admin');
insert into app_settings (key, value) values ('ad_frequency', '8') on conflict do nothing;

-- Per-district totals for the CMS dashboard (last 30 days).
create or replace view analytics_district with (security_invoker = true) as
  select district_id, sum(views)::int as views, sum(flips)::int as flips, sum(shares)::int as shares, sum(readers)::int as readers
  from analytics_daily where day > current_date - 30 group by district_id;

-- Deleting a poll failed: option labels and votes referenced poll_options without cascading.
alter table poll_option_labels drop constraint poll_option_labels_poll_id_option_id_fkey,
  add constraint poll_option_labels_poll_id_option_id_fkey foreign key (poll_id, option_id) references poll_options (poll_id, id) on delete cascade;
alter table votes drop constraint votes_poll_id_option_id_fkey,
  add constraint votes_poll_id_option_id_fkey foreign key (poll_id, option_id) references poll_options (poll_id, id) on delete cascade;
