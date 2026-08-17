-- Acquisition + onboarding fields for Cohort 1 analytics.
-- Paste into Supabase → SQL editor → Run.

alter table public.profiles
  add column if not exists acquisition_source text,
  add column if not exists acquisition_campaign text,
  add column if not exists activation_date text,
  add column if not exists referrer_user_id uuid,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists first_surface text,
  add column if not exists onboarding_version text;

comment on column public.profiles.acquisition_source is 'First-touch source (e.g. reformation_sample_sale)';
comment on column public.profiles.acquisition_campaign is 'Campaign (e.g. reformation_monday)';
comment on column public.profiles.activation_date is 'Cohort activation date YYYY-MM-DD';
comment on column public.profiles.referrer_user_id is 'Existing yom user who referred this signup';
comment on column public.profiles.first_surface is 'web | mobile_web | extension';
comment on column public.profiles.onboarding_version is 'Survey/onboarding version string';
