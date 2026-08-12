-- Enable Supabase Realtime for the messages table.
-- Sin esto, los INSERT de mensajes NO se emiten por realtime: el chat y las
-- notificaciones (toast + sonido en el sidebar) solo aparecían al recargar la
-- página, nunca en vivo. channel_reads y message_reactions ya estaban en la
-- publicación (por eso los tildes de leído y las reacciones sí eran live).
-- Aplicado en producción 2026-08-12.
--
-- Run once in Supabase Dashboard → SQL Editor, or via migrations.

alter publication supabase_realtime add table public.messages;
