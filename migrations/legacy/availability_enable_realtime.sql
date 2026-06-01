-- Enable Supabase Realtime for availability table
-- Required for the KPI live-update subscription in Availability.html
-- Run once in Supabase Dashboard → SQL Editor, or via migrations.

alter publication supabase_realtime add table availability;
