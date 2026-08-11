-- Migration 128: price_id de Paddle SANDBOX en las columnas reales de la tabla plans.
-- Las columnas provider_price_monthly_id / provider_price_yearly_id YA existen (naming
-- neutro de proveedor); acá solo cargamos los IDs sandbox para testing.
-- Cuando pasemos a producción, se rehace este UPDATE con los IDs live.
-- (Descarta el enfoque paddle_price_* de la migración 127, que nunca se aplicó.)

update public.plans set
  provider_price_monthly_id = 'pri_01kzq1ape9jsp9h8m71s9pm76e',
  provider_price_yearly_id  = 'pri_01kzq1bc6fvw33xzbk4cnyghz3'
where slug = 'basic';

update public.plans set
  provider_price_monthly_id = 'pri_01kzq1btmpbnw8m1f1b3cv93vq',
  provider_price_yearly_id  = 'pri_01kzq1c6n0b6pxxv72re2a6jaw'
where slug = 'professional';

update public.plans set
  provider_price_monthly_id = 'pri_01kzq1cm49xg7kg18whazcxznc',
  provider_price_yearly_id  = 'pri_01kzq1d1rvcrd8s9bpc6c1g21t'
where slug = 'full';
