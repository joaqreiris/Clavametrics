-- Migración 173: los avatares dejan de guardar una URL firmada por 10 años.
--
-- Encontrado al contestar el cuestionario de la abogada. Al subir un avatar se firmaba la URL
-- por 315.360.000 segundos —unos diez años— y ESA url quedaba guardada en profiles.avatar_url.
-- Resultado: nueve enlaces vivos durante una década a la foto de miembros del staff, que
-- funcionan para cualquiera que los tenga aunque la persona ya no esté en el club.
--
-- El frontend ya sabía resolverlo bien: cmAvatarUrl() distingue entre una URL completa (la usa
-- tal cual) y una ruta (la firma bajo demanda con TTL de 7 días, refrescado un día antes). Sólo
-- se estaba guardando el valor equivocado. El código ya guarda la ruta; esto arregla las filas
-- viejas.
--
-- La URL tiene la forma:
--   https://<proyecto>.supabase.co/storage/v1/object/sign/profile-avatars/<uid>/avatar.jpg?token=…
-- y la ruta es lo que va entre '/profile-avatars/' y el '?'.

update public.profiles
   set avatar_url = split_part(
         substring(avatar_url from position('/profile-avatars/' in avatar_url) + length('/profile-avatars/')),
         '?', 1)
 where avatar_url like 'http%'
   and position('/profile-avatars/' in avatar_url) > 0;

-- Red de seguridad: si alguna fila quedó con una URL firmada de larga duración, que se vea.
do $$
declare v_n int;
begin
  select count(*) into v_n from public.profiles
  where avatar_url like '%/object/sign/%' and avatar_url like '%token=%';
  if v_n > 0 then
    raise exception 'quedan % avatares guardados como URL firmada en vez de ruta', v_n;
  end if;
end $$;
