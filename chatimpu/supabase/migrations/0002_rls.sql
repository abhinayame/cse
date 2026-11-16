-- Row level security (safe to re-run: each policy is dropped first) ─────────────────────────────────────────────
create or replace function my_role() returns role_kind language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()), 'reader'::role_kind)
$$;
create or replace function is_staff() returns boolean language sql stable as $$
  select my_role() in ('super_admin', 'editor', 'district_moderator', 'reporter')
$$;
create or replace function moderates(d text) returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('super_admin', 'editor')
      or exists (select 1 from moderator_districts where user_id = auth.uid() and district_id = d)
$$;

do $$ declare t text; begin
  foreach t in array array['languages','categories','category_names','states','districts','mandals','villages','stories','story_translations','story_tags',
    'bookmarks','reactions','comments','read_events','polls','poll_questions','poll_options','poll_option_labels','votes','magazines','magazine_stories',
    'local_alerts','citizen_reports','advertisers','ads','videos','push_tokens','profiles','moderator_districts'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Public read of reference + published content
drop policy if exists read_all on languages;
create policy read_all on languages for select using (true);
drop policy if exists read_all on categories;
create policy read_all on categories for select using (true);
drop policy if exists read_all on category_names;
create policy read_all on category_names for select using (true);
drop policy if exists read_all on states;
create policy read_all on states for select using (true);
drop policy if exists read_all on districts;
create policy read_all on districts for select using (true);
drop policy if exists read_all on mandals;
create policy read_all on mandals for select using (true);
drop policy if exists read_all on villages;
create policy read_all on villages for select using (true);
drop policy if exists read_published on stories;
create policy read_published on stories for select using (status = 'published' and published_at <= now() or is_staff());
drop policy if exists read_published on story_translations;
create policy read_published on story_translations for select using (exists (select 1 from stories s where s.id = story_id and (s.status = 'published' or is_staff())));
drop policy if exists read_all on story_tags;
create policy read_all on story_tags for select using (true);
drop policy if exists read_all on polls;
create policy read_all on polls for select using (true);
drop policy if exists read_all on poll_questions;
create policy read_all on poll_questions for select using (true);
drop policy if exists read_all on poll_options;
create policy read_all on poll_options for select using (true);
drop policy if exists read_all on poll_option_labels;
create policy read_all on poll_option_labels for select using (true);
drop policy if exists read_all on magazines;
create policy read_all on magazines for select using (published or is_staff());
drop policy if exists read_all on magazine_stories;
create policy read_all on magazine_stories for select using (true);
drop policy if exists read_all on local_alerts;
create policy read_all on local_alerts for select using (true);
drop policy if exists read_active on ads;
create policy read_active on ads for select using (status = 'active' or is_staff());
drop policy if exists read_all on videos;
create policy read_all on videos for select using (true);
drop policy if exists read_visible on comments;
create policy read_visible on comments for select using (not hidden or is_staff());

-- Staff writes
drop policy if exists staff_write on stories;
create policy staff_write on stories for all using (
  my_role() in ('super_admin','editor') or (my_role() = 'district_moderator' and moderates(district_id)) or (my_role() = 'reporter' and author_id = auth.uid() and status = 'draft')
) with check (
  my_role() in ('super_admin','editor') or (my_role() = 'district_moderator' and moderates(district_id)) or (my_role() = 'reporter' and author_id = auth.uid() and status = 'draft')
);
drop policy if exists staff_write on story_translations;
create policy staff_write on story_translations for all using (is_staff()) with check (is_staff());
drop policy if exists staff_write on story_tags;
create policy staff_write on story_tags for all using (is_staff()) with check (is_staff());
drop policy if exists staff_write on local_alerts;
create policy staff_write on local_alerts for all using (moderates(district_id)) with check (moderates(district_id));
drop policy if exists staff_write on polls;
create policy staff_write on polls for all using (my_role() in ('super_admin','editor')) with check (my_role() in ('super_admin','editor'));
drop policy if exists staff_write on magazines;
create policy staff_write on magazines for all using (my_role() in ('super_admin','editor')) with check (my_role() in ('super_admin','editor'));
drop policy if exists admin_write on ads;
create policy admin_write on ads for all using (my_role() = 'super_admin') with check (my_role() = 'super_admin');
drop policy if exists admin_write on advertisers;
create policy admin_write on advertisers for all using (my_role() = 'super_admin') with check (my_role() = 'super_admin');
drop policy if exists moderate_comments on comments;
create policy moderate_comments on comments for update using (is_staff());

-- Reader-owned rows
drop policy if exists own on profiles;
create policy own on profiles for select using (id = auth.uid() or is_staff());
drop policy if exists own_update on profiles;
create policy own_update on profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
drop policy if exists admin_roles on profiles;
create policy admin_roles on profiles for update using (my_role() = 'super_admin');
drop policy if exists own on bookmarks;
create policy own on bookmarks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists own on reactions;
create policy own on reactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists own_insert on comments;
create policy own_insert on comments for insert with check (user_id = auth.uid());
drop policy if exists own on push_tokens;
create policy own on push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists insert_events on read_events;
create policy insert_events on read_events for insert with check (user_id is null or user_id = auth.uid());
drop policy if exists staff_read on read_events;
create policy staff_read on read_events for select using (is_staff());
drop policy if exists own_votes on votes;
create policy own_votes on votes for select using (user_id = auth.uid());

-- Citizen reports: only verified reporters can submit; moderators see their districts
drop policy if exists submit on citizen_reports;
create policy submit on citizen_reports for insert with check (
  reporter_id = auth.uid() and exists (select 1 from profiles where id = auth.uid() and verified_reporter)
);
drop policy if exists read_own_or_moderate on citizen_reports;
create policy read_own_or_moderate on citizen_reports for select using (reporter_id = auth.uid() or moderates(district_id));
drop policy if exists moderate on citizen_reports;
create policy moderate on citizen_reports for update using (moderates(district_id));

-- Storage bucket for media (images, citizen uploads)
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict do nothing;
drop policy if exists "verified upload citizen media" on storage.objects;
create policy "verified upload citizen media" on storage.objects for insert with check (
  bucket_id = 'media' and (storage.foldername(name))[1] = 'citizen'
  and exists (select 1 from public.profiles where id = auth.uid() and verified_reporter)
);
drop policy if exists "staff upload" on storage.objects;
create policy "staff upload" on storage.objects for insert with check (bucket_id = 'media' and public.is_staff());
