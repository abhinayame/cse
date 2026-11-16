-- Row level security ─────────────────────────────────────────────
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
create policy read_all on languages for select using (true);
create policy read_all on categories for select using (true);
create policy read_all on category_names for select using (true);
create policy read_all on states for select using (true);
create policy read_all on districts for select using (true);
create policy read_all on mandals for select using (true);
create policy read_all on villages for select using (true);
create policy read_published on stories for select using (status = 'published' and published_at <= now() or is_staff());
create policy read_published on story_translations for select using (exists (select 1 from stories s where s.id = story_id and (s.status = 'published' or is_staff())));
create policy read_all on story_tags for select using (true);
create policy read_all on polls for select using (true);
create policy read_all on poll_questions for select using (true);
create policy read_all on poll_options for select using (true);
create policy read_all on poll_option_labels for select using (true);
create policy read_all on magazines for select using (published or is_staff());
create policy read_all on magazine_stories for select using (true);
create policy read_all on local_alerts for select using (true);
create policy read_active on ads for select using (status = 'active' or is_staff());
create policy read_all on videos for select using (true);
create policy read_visible on comments for select using (not hidden or is_staff());

-- Staff writes
create policy staff_write on stories for all using (
  my_role() in ('super_admin','editor') or (my_role() = 'district_moderator' and moderates(district_id)) or (my_role() = 'reporter' and author_id = auth.uid() and status = 'draft')
) with check (
  my_role() in ('super_admin','editor') or (my_role() = 'district_moderator' and moderates(district_id)) or (my_role() = 'reporter' and author_id = auth.uid() and status = 'draft')
);
create policy staff_write on story_translations for all using (is_staff()) with check (is_staff());
create policy staff_write on story_tags for all using (is_staff()) with check (is_staff());
create policy staff_write on local_alerts for all using (moderates(district_id)) with check (moderates(district_id));
create policy staff_write on polls for all using (my_role() in ('super_admin','editor')) with check (my_role() in ('super_admin','editor'));
create policy staff_write on magazines for all using (my_role() in ('super_admin','editor')) with check (my_role() in ('super_admin','editor'));
create policy admin_write on ads for all using (my_role() = 'super_admin') with check (my_role() = 'super_admin');
create policy admin_write on advertisers for all using (my_role() = 'super_admin') with check (my_role() = 'super_admin');
create policy moderate_comments on comments for update using (is_staff());

-- Reader-owned rows
create policy own on profiles for select using (id = auth.uid() or is_staff());
create policy own_update on profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
create policy admin_roles on profiles for update using (my_role() = 'super_admin');
create policy own on bookmarks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on reactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_insert on comments for insert with check (user_id = auth.uid());
create policy own on push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy insert_events on read_events for insert with check (user_id is null or user_id = auth.uid());
create policy staff_read on read_events for select using (is_staff());
create policy own_votes on votes for select using (user_id = auth.uid());

-- Citizen reports: only verified reporters can submit; moderators see their districts
create policy submit on citizen_reports for insert with check (
  reporter_id = auth.uid() and exists (select 1 from profiles where id = auth.uid() and verified_reporter)
);
create policy read_own_or_moderate on citizen_reports for select using (reporter_id = auth.uid() or moderates(district_id));
create policy moderate on citizen_reports for update using (moderates(district_id));

-- Storage bucket for media (images, citizen uploads)
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict do nothing;
create policy "verified upload citizen media" on storage.objects for insert with check (
  bucket_id = 'media' and (storage.foldername(name))[1] = 'citizen'
  and exists (select 1 from public.profiles where id = auth.uid() and verified_reporter)
);
create policy "staff upload" on storage.objects for insert with check (bucket_id = 'media' and public.is_staff());
