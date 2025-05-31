-- Auto-verification for Supabase user emails
-- This script automatically confirms email addresses when users register

-- Set up a trigger to automatically confirm email addresses
create or replace function public.handle_new_user()
returns trigger as $$
begin
  update auth.users
  set email_confirmed_at = now()
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- For testing: You can confirm this with:
-- SELECT email, email_confirmed_at FROM auth.users; 