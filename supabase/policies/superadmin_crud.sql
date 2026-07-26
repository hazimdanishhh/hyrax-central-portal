alter policy "Superadmin CRUD"
on "public"."attendance_activities"
to authenticated
using (
    (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role_id = 3))))
) with check (
    (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role_id = 3))))
);