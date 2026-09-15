-- Migración 167: que un veto se lea, no que muestre un UUID.
--
-- La lista de vetados es LA función de conflicto de interés, y en pantalla salía "pa-9".
-- El club no puede resolver ese id: los admins de plataforma no están en su tabla de
-- perfiles (profiles_super_select es sólo para plataforma), así que un join no arregla
-- nada — no es un problema de la consulta, es que el dato no le es visible.
--
-- Se congela el email en la propia fila al crearla. El trigger corre como owner y sí lee
-- profiles. Queda como un dato histórico a propósito: si esa persona cambia de mail o se
-- borra su perfil, el club tiene que seguir viendo a quién vetó y por qué.

alter table public.support_restrictions
  add column if not exists admin_email text;

create or replace function public.support_restrictions_stamp_email()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.admin_email is null then
    select p.email into new.admin_email from public.profiles p where p.id = new.admin_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists support_restrictions_email on public.support_restrictions;
create trigger support_restrictions_email
  before insert on public.support_restrictions
  for each row execute function public.support_restrictions_stamp_email();

-- Rellenar las que ya existan (en la práctica ninguna todavía, pero la migración tiene que
-- poder correrse sobre una base que ya venía usándose).
update public.support_restrictions r
   set admin_email = p.email
  from public.profiles p
 where p.id = r.admin_user_id and r.admin_email is null;
