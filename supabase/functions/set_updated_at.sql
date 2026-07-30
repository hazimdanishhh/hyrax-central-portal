-- arguments: none
-- returns: trigger

BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;