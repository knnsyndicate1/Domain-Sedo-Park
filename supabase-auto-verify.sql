-- Function to auto-verify knnsyndicate.com emails on signup
CREATE OR REPLACE FUNCTION public.auto_verify_knnsyndicate_emails()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email LIKE '%@knnsyndicate.com' THEN
    -- Auto-verify the email address immediately
    UPDATE auth.users
    SET email_confirmed_at = NOW(),
        confirmed_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-verify on new user creation
DROP TRIGGER IF EXISTS auto_verify_knnsyndicate_emails_trigger ON auth.users;
CREATE TRIGGER auto_verify_knnsyndicate_emails_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_verify_knnsyndicate_emails();

-- For testing: You can confirm this with:
-- SELECT email, email_confirmed_at FROM auth.users; 