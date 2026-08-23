-- Backfill: every person the google sheet caught before supabase was connected.
--
-- Until 2026-08-22 ~17:38 PDT the sheet webhook was the only store, and it was
-- silently dropping writes — the leads tab stopped at Aug 19 while scan_visitors
-- kept recording emails through Aug 22. These rows are reconstructed from both
-- tabs so supabase holds one list instead of two partial ones.
--
-- Safe to re-run: upserts on email, and never overwrites a newer record.

insert into public.leads (email, name, source, campaign, surface, path, channel, anon_id, created_at, updated_at)
values
  -- reformation sample sale, aug 18-19
  ('alicebrashares@gmail.com', 'Alice brashares', 'reformation_sample_sale', 'reformation_monday', 'mobile_web', '/join', 'join_create', 'e269fa82-d84e-4830-9999-2165e8759f88', '2026-08-18T19:37:32Z', now()),
  ('avadinapoli8@gmail.com',   'Ava',             'reformation_sample_sale', 'reformation_monday', 'mobile_web', '/join', 'join_create', '896a0632-7675-4db6-af8e-b70ad17524a6', '2026-08-18T23:30:11Z', now()),
  ('amiebatsukh@gmail.com',    'Amie',            'reformation_sample_sale', 'reformation_monday', 'mobile_web', '/join', 'join_create', 'b70e49e4-0bac-487a-9236-8d1360397df6', '2026-08-18T23:30:21Z', now()),
  ('anisa.s.hackett@gmail.com','Anisa',           'reformation_sample_sale', 'reformation_monday', 'mobile_web', '/join', 'join_create', '40ee8a43-e7ef-4a83-acec-98221efba729', '2026-08-18T23:37:22Z', now()),
  ('ashabui0514@gmail.com',    'Asha',            'reformation_sample_sale', 'reformation_monday', 'mobile_web', '/join', 'join_create', 'cfa9aee2-018a-4b6e-bec0-f4d62e1e4537', '2026-08-18T23:38:34Z', now()),
  ('akapur2008@gmail.com',     'Amara Kapur',     'reformation_sample_sale', 'reformation_monday', 'mobile_web', '/join', 'join_create', 'c08c736d-2c55-4312-ae78-ffc00260c0b9', '2026-08-18T23:40:11Z', now()),
  ('jolinstay@outlook.com',    'Jolin',           'reformation_sample_sale', 'reformation_monday', 'mobile_web', '/join', 'join_create', '6e284556-5a64-493e-be51-c7f25cf81a5e', '2026-08-19T04:53:26Z', now()),

  -- berkeley flyer, aug 22 — never reached the leads tab at all
  ('hadleyelliott@gmail.com',  null, 'berkeley_flyer', 'berkeley_fpr_2026', 'mobile_web', '/join', 'scan', '2eeb20ac-5975-4f93-9f36-a1ef1a54813e', '2026-08-22T20:21:01Z', now()),
  ('masoom.parida@gmail.com',  null, 'berkeley_flyer', 'berkeley_fpr_2026', 'mobile_web', '/join', 'scan', '0f66a5a4-fe88-4481-bde3-2b044a2937af', '2026-08-22T20:44:17Z', now()),
  ('anisaskhan2008@gmail.com', null, 'berkeley_flyer', 'berkeley_fpr_2026', 'mobile_web', '/join', 'scan', 'e554c87c-dae0-4ae6-b5f1-bbcc5c520fb0', '2026-08-22T20:45:00Z', now()),
  ('rebekah.godoy@berkeley.edu', null, 'berkeley_flyer', 'berkeley_fpr_2026', 'mobile_web', '/join', 'join_create', '8c2d0707-ef4e-4dd3-bc92-9caee827fe2c', '2026-08-22T20:45:37Z', now()),
  ('anniezaumeyer@gmail.com',  null, 'berkeley_flyer', 'berkeley_fpr_2026', 'mobile_web', '/join', 'scan', '8e560ee0-51d2-4e05-8514-c9eabba31a6d', '2026-08-22T21:27:37Z', now()),
  ('nicolette.cohen@lbusd.org',null, 'berkeley_flyer', 'berkeley_fpr_2026', 'mobile_web', '/scan', 'scan', 'eb6ec8db-483a-4545-8ef2-0d38eaa0e141', '2026-08-22T21:29:08Z', now()),
  ('isabelleobolsky@gmail.com',null, 'berkeley_flyer', 'berkeley_fpr_2026', 'mobile_web', '/join', 'scan', '23430c2e-b296-4953-839e-1cf4487e1803', '2026-08-22T23:46:39Z', now())
on conflict (email) do update
  set name       = coalesce(public.leads.name, excluded.name),
      source     = coalesce(public.leads.source, excluded.source),
      campaign   = coalesce(public.leads.campaign, excluded.campaign),
      anon_id    = coalesce(public.leads.anon_id, excluded.anon_id),
      created_at = least(public.leads.created_at, excluded.created_at);

-- Who came from where, once it lands.
select campaign, count(*) as people
from public.leads
group by campaign
order by people desc;
