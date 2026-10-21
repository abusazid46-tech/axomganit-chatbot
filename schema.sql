-- ==============================================================
-- Axomগণিত Pro (Axomganit Chatbot) - Supabase Database Schema
-- Run this in Supabase SQL Editor to enable User Auth & Subscriptions
-- ==============================================================

-- 1. Create public profiles table linked to Supabase auth.users
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  plan text default 'free' check (plan in ('free', 'pro_daily', 'pro_monthly', 'pro_annual')),
  pro_valid_until timestamp with time zone,
  daily_solve_count integer default 0,
  last_solve_date date default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Policy: Users can view their own profile
create policy "Users can view own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

-- Policy: Users can update their own profile
create policy "Users can update own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

-- Policy: Service role can do everything
create policy "Service role full access"
  on public.profiles for all
  using (auth.role() = 'service_role');

-- 3. Automatic Profile Creation Trigger on Supabase Sign Up (Google / Email)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, plan)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 
    new.raw_user_meta_data->>'avatar_url', 
    'free'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Create public payments table to track UPI transactions & prevent duplicate UTR redemption
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  user_email text,
  plan text not null,
  amount integer not null,
  order_id text unique not null,
  utr text unique not null,
  status text default 'completed',
  valid_until timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.payments enable row level security;

create policy "Users can view own payments" 
  on public.payments for select 
  using (auth.uid() = user_id);

create policy "Service role full access payments" 
  on public.payments for all 
  using (auth.role() = 'service_role');
