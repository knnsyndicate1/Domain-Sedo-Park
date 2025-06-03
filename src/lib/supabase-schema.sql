-- Check if tables exist and drop them if needed
DROP TABLE IF EXISTS public.user_approval;
DROP TABLE IF EXISTS public.user_roles;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create user_approval table
CREATE TABLE public.user_approval (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add RLS policies
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_approval ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own approval status" ON public.user_approval;
DROP POLICY IF EXISTS "First admin has full access" ON public.user_roles;
DROP POLICY IF EXISTS "First admin can manage approvals" ON public.user_approval;
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can read all approvals" ON public.user_approval;
DROP POLICY IF EXISTS "Admins can update approvals" ON public.user_approval;

-- All users can read their own roles
CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- All users can read their own approval status
CREATE POLICY "Users can read own approval status" ON public.user_approval
  FOR SELECT USING (auth.uid() = user_id);

-- IMPORTANT: Special policy to allow first admin to have direct access
-- This avoids the circular reference problem
CREATE POLICY "First admin has full access" ON public.user_roles
  USING (
    (SELECT COUNT(*) FROM public.user_roles) <= 1
  );

-- Special policy for first admin to access approvals
CREATE POLICY "First admin can manage approvals" ON public.user_approval
  USING (
    (SELECT COUNT(*) FROM public.user_roles) <= 1
  );

-- Once we have more than one record, these policies will apply:
-- Admin can read all roles based on their user_id
CREATE POLICY "Admins can read all roles" ON public.user_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can update roles
CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can read all approvals
CREATE POLICY "Admins can read all approvals" ON public.user_approval
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can update approval status
CREATE POLICY "Admins can update approvals" ON public.user_approval
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Drop the trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Add new user to approval table with pending status
  INSERT INTO public.user_approval (user_id, email, status)
  VALUES (NEW.id, NEW.email, 'pending');
  
  -- The first user to sign up becomes an admin, but still needs approval
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function on each new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 