-- =========================================================
-- 045 — Nutrition Module · Seed de `foods` (catálogo global)
-- ~80 alimentos comunes, macros por 100 g, source='manual',
-- is_verified=false (aproximados; un super-admin puede verificar
-- o reemplazar por USDA luego — el `source` los distingue).
-- Idempotente: no duplica si el alimento (por nombre) ya existe.
-- Items por unidad → default_unit='unit' + per_unit_grams.
-- =========================================================

insert into public.foods
  (name, category, kcal, protein_g, carbs_g, fats_g, fiber_g, default_unit, per_unit_grams, source, is_verified)
select v.name, v.category, v.kcal, v.protein_g, v.carbs_g, v.fats_g, v.fiber_g,
       v.default_unit, v.per_unit_grams, 'manual', false
from (values
  -- ───────── PROTEIN ─────────
  ('Chicken breast, grilled','protein',165,31,0,3.6,0,'g',null::numeric),
  ('Turkey breast, cooked','protein',135,30,0,1,0,'g',null),
  ('Beef sirloin, lean, cooked','protein',183,27,0,8,0,'g',null),
  ('Ground beef 90/10, cooked','protein',176,26,0,8,0,'g',null),
  ('Pork loin, cooked','protein',143,26,0,4,0,'g',null),
  ('Salmon, cooked','protein',208,20,0,13,0,'g',null),
  ('Tuna, canned in water','protein',116,26,0,1,0,'g',null),
  ('Cod, cooked','protein',105,23,0,1,0,'g',null),
  ('Shrimp, cooked','protein',99,24,0.2,0.3,0,'g',null),
  ('Egg, whole','protein',143,13,1,10,0,'unit',50),
  ('Egg white','protein',52,11,0.7,0.2,0,'g',null),
  ('Tofu, firm','protein',144,15,3,8.7,2,'g',null),
  ('Edamame, cooked','protein',121,12,9,5,5,'g',null),
  ('Lentils, cooked','protein',116,9,20,0.4,8,'g',null),
  ('Chickpeas, cooked','protein',164,9,27,2.6,8,'g',null),
  ('Black beans, cooked','protein',132,8.9,24,0.5,8.7,'g',null),
  -- ───────── CARB ─────────
  ('White rice, cooked','carb',130,2.7,28,0.3,0.4,'g',null),
  ('Brown rice, cooked','carb',112,2.6,24,0.9,1.8,'g',null),
  ('Pasta, cooked','carb',158,5.8,31,0.9,1.8,'g',null),
  ('Whole wheat pasta, cooked','carb',149,6,30,1.3,4,'g',null),
  ('Oats, dry','carb',389,17,66,7,10,'g',null),
  ('Potato, boiled','carb',87,2,20,0.1,1.8,'g',null),
  ('Sweet potato, baked','carb',90,2,21,0.1,3.3,'g',null),
  ('White bread','carb',265,9,49,3.2,2.7,'g',null),
  ('Whole wheat bread','carb',247,13,41,3.4,7,'g',null),
  ('Quinoa, cooked','carb',120,4.4,21,1.9,2.8,'g',null),
  ('Couscous, cooked','carb',112,3.8,23,0.2,1.4,'g',null),
  ('Corn, cooked','carb',96,3.4,21,1.5,2.4,'g',null),
  ('Bagel','carb',250,10,49,1.5,2.1,'g',null),
  ('Wheat tortilla','carb',312,8,51,8,3,'g',null),
  ('Cornflakes','carb',357,7,84,0.4,3,'g',null),
  ('Maltodextrin','carb',380,0,95,0,0,'g',null),
  ('Honey','carb',304,0.3,82,0,0,'g',null),
  -- ───────── FRUIT ─────────
  ('Banana','fruit',89,1.1,23,0.3,2.6,'unit',120),
  ('Apple','fruit',52,0.3,14,0.2,2.4,'unit',180),
  ('Orange','fruit',47,0.9,12,0.1,2.4,'unit',130),
  ('Kiwi','fruit',61,1.1,15,0.5,3,'unit',75),
  ('Strawberries','fruit',32,0.7,7.7,0.3,2,'g',null),
  ('Blueberries','fruit',57,0.7,14,0.3,2.4,'g',null),
  ('Grapes','fruit',69,0.7,18,0.2,0.9,'g',null),
  ('Pineapple','fruit',50,0.5,13,0.1,1.4,'g',null),
  ('Mango','fruit',60,0.8,15,0.4,1.6,'g',null),
  ('Watermelon','fruit',30,0.6,8,0.2,0.4,'g',null),
  ('Dates, dried','fruit',277,1.8,75,0.2,6.7,'g',null),
  ('Raisins','fruit',299,3.1,79,0.5,3.7,'g',null),
  -- ───────── VEGETABLE ─────────
  ('Broccoli, cooked','vegetable',35,2.4,7,0.4,3.3,'g',null),
  ('Spinach, raw','vegetable',23,2.9,3.6,0.4,2.2,'g',null),
  ('Carrot','vegetable',41,0.9,10,0.2,2.8,'g',null),
  ('Tomato','vegetable',18,0.9,3.9,0.2,1.2,'g',null),
  ('Cucumber','vegetable',15,0.7,3.6,0.1,0.5,'g',null),
  ('Lettuce','vegetable',15,1.4,2.9,0.2,1.3,'g',null),
  ('Bell pepper','vegetable',31,1,6,0.3,2.1,'g',null),
  ('Green beans, cooked','vegetable',35,1.9,7.9,0.1,3.4,'g',null),
  ('Zucchini','vegetable',17,1.2,3.1,0.3,1,'g',null),
  ('Mushrooms','vegetable',22,3.1,3.3,0.3,1,'g',null),
  ('Onion','vegetable',40,1.1,9,0.1,1.7,'g',null),
  ('Peas, cooked','vegetable',84,5.4,16,0.2,5.5,'g',null),
  -- ───────── DAIRY ─────────
  ('Greek yogurt, nonfat','dairy',59,10,3.6,0.4,0,'g',null),
  ('Greek yogurt, whole','dairy',97,9,4,5,0,'g',null),
  ('Milk, whole','dairy',61,3.2,4.8,3.3,0,'ml',null),
  ('Milk, skim','dairy',34,3.4,5,0.1,0,'ml',null),
  ('Cottage cheese, lowfat','dairy',72,12,4.3,1,0,'g',null),
  ('Mozzarella','dairy',280,28,3.1,17,0,'g',null),
  ('Cheddar','dairy',403,25,1.3,33,0,'g',null),
  ('Parmesan','dairy',392,35,3.2,26,0,'g',null),
  ('Fresh cheese','dairy',264,18,3,20,0,'g',null),
  ('Butter','dairy',717,0.9,0.1,81,0,'g',null),
  -- ───────── FAT ─────────
  ('Olive oil','fat',884,0,0,100,0,'g',null),
  ('Avocado','fat',160,2,9,15,7,'g',null),
  ('Almonds','fat',579,21,22,50,12,'g',null),
  ('Walnuts','fat',654,15,14,65,7,'g',null),
  ('Cashews','fat',553,18,30,44,3,'g',null),
  ('Peanuts','fat',567,26,16,49,8,'g',null),
  ('Peanut butter','fat',588,25,20,50,6,'g',null),
  ('Chia seeds','fat',486,17,42,31,34,'g',null),
  ('Flax seeds','fat',534,18,29,42,27,'g',null),
  ('Dark chocolate 70%','fat',598,7.8,46,43,11,'g',null),
  -- ───────── SUPPLEMENT ─────────
  ('Whey protein isolate','supplement',360,80,6,4,0,'g',null),
  ('Casein protein','supplement',360,78,8,2,0,'g',null),
  ('Creatine monohydrate','supplement',0,0,0,0,0,'g',null),
  ('BCAA powder','supplement',0,0,0,0,0,'g',null),
  ('Energy gel','supplement',250,0,62,0,0,'g',null),
  ('Isotonic drink','supplement',24,0,6,0,0,'ml',null),
  ('Protein bar','supplement',350,30,40,10,3,'g',null),
  -- ───────── OTHER ─────────
  ('Hummus','other',166,8,14,10,6,'g',null)
) as v(name, category, kcal, protein_g, carbs_g, fats_g, fiber_g, default_unit, per_unit_grams)
where not exists (
  select 1 from public.foods f where lower(f.name) = lower(v.name)
);
