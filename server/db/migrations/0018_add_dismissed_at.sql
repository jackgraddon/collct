-- Add dismissed_at column to notifications for soft-delete dismiss behavior
-- Apply via direct SQL: the NuxtHub migration system cannot handle this on existing databases.
ALTER TABLE notifications ADD COLUMN dismissed_at timestamp;
