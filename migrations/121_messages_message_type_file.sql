-- 121_messages_message_type_file.sql
-- Chat attachments send message_type='file', which the original CHECK constraint didn't allow (error 23514).
-- Widen the constraint to include 'file'.
alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check
  check (message_type = any (array['text'::text, 'file'::text, 'task_ref'::text, 'report_share'::text, 'system'::text]));
