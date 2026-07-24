ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_group_id_groups_id_fk;
ALTER TABLE notifications ALTER COLUMN group_id TYPE text USING group_id::text;
