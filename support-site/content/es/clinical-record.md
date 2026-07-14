---
title: Registro Clínico
slug: clinical-record
world: medical
app_page: Clinical Record.html
order: 3
summary: El archivo clínico completo de un jugador — perfil médico, medicaciones, screenings, episodios, cirugías, estudios y documentos — restringido a roles médicos.
---

## Qué es

El Registro Clínico es el archivo médico completo de un jugador: su perfil médico, medicaciones, screenings, episodios de enfermedad/lesión, cirugías, estudios de imagen y documentos clínicos. Son los datos más sensibles de la app y están restringidos a roles médicos.

## Cuándo se usa

Cuando el cuerpo médico necesita la imagen clínica completa de un jugador — revisar el historial, registrar un screening o episodio, registrar una cirugía o estudio, o subir un informe. Es el archivo profundo detrás del índice a nivel de plantel de [Registros Clínicos](/support/clinical-records).

## Cómo funciona

**Abrir un jugador.** Llegas a un registro desde el índice de [Registros Clínicos](/support/clinical-records) (por jugador). La página carga el archivo de ese jugador a través de varias pestañas.

**Leer la vista general.** La vista general muestra KPI destacados, una línea de tiempo de lesiones y un **mapa de calor corporal** (ver Conceptos clave).

**Trabajar los módulos.** Las pestañas cubren cada parte del archivo — historial de lesiones, enfermedad y episodios (incluidos los pasos de retorno al juego por conmoción), historial quirúrgico, tratamientos (solo lectura, desde Fisioterapia), estudios de imagen y documentos. Añades o editas entradas en cada módulo, y subes imágenes o documentos (archivos de imagen/PDF hasta el límite de tamaño).

**Perfil de base.** Una tarjeta de base médica contiene el perfil del jugador — grupo sanguíneo, alergias, condiciones crónicas, antecedentes familiares, médico tratante, seguro y fechas de revisión — editable desde su modal.

## Conceptos clave

**Los siete módulos.** El registro se construye a partir de siete tablas médicas:

| Módulo | Contiene |
| --- | --- |
| Perfil médico | Grupo sanguíneo, alergias, condiciones crónicas, antecedentes familiares, médico tratante, seguro, fechas de revisión |
| Medicaciones | Nombre, dosis, frecuencia, motivo, indicador de suplemento, exención de uso terapéutico, fechas, activo |
| Screenings | Controles cardíacos/preventivos (ECG, eco, prueba de esfuerzo, visión, dental…), estado, resultado, fechas |
| Episodios | Enfermedad / conmoción / otros episodios — estado, sistema, diagnóstico, fechas, días perdidos |
| Cirugías | Procedimiento, fecha, lateralidad, cirujano, clínica, implantes, resultado |
| Estudios | Imagen y laboratorio (RM, ecografía, radiografía, TC, laboratorio…), zona corporal, hallazgo, archivo |
| Documentos | Informes, consentimientos, certificados, seguro, otros — título, archivo |

Las lesiones y tratamientos (desde [Lesiones](/support/injuries) y [Fisioterapia](/support/physio)) también se muestran aquí para dar contexto. Esta documentación describe los campos; el contenido clínico es dominio del cuerpo médico.

**El mapa de calor corporal.** El mapa de calor asigna las lesiones a las regiones corporales: cada región muestra el número de lesiones ahí y se colorea según la peor severidad registrada (menor / moderada / severa). Las lesiones activas resaltan, y hacer clic en una región filtra el historial de lesiones a esa región — una lectura rápida de dónde se rompe un jugador.

**Índice vs archivo individual.** La página de [Registros Clínicos](/support/clinical-records) es el **índice del plantel** — una vista general a nivel de roster con el estado y el problema destacado de cada jugador. Este **registro individual** es el archivo profundo de un jugador. Vas desde el índice hacia el registro.

**Acceso — restringido a roles médicos.** Esta es la parte estricta, y se aplica en dos lugares:

- **La página** redirige al hub a cualquiera que no sea un rol médico (la puerta del módulo clínico).
- **La base de datos** aplica el acceso médico en cada tabla clínica: un usuario solo ve estos datos si es **superadministrador** o su rol es **administrador, propietario o fisioterapeuta**. Un rol de entrenador o S&C no pasa.
- **Los documentos** viven en un bucket de almacenamiento **privado** (no público); los archivos se sirven a través de **URLs firmadas** de corta duración, y las propias reglas de acceso del bucket requieren el mismo acceso médico y el mismo club. Así que los documentos clínicos nunca son abiertamente accesibles.

## FAQ

**¿Quién puede abrir el registro clínico de un jugador?** Solo los roles médicos — superadministrador, o un usuario cuyo rol sea administrador, propietario o fisioterapeuta. Los demás son redirigidos, y la base de datos no les devuelve ningún dato clínico.

**¿Los documentos subidos son públicos?** No. Están en un bucket privado y se abren mediante URLs firmadas de corta duración, controladas a roles médicos dentro del mismo club.

**¿Cuál es la diferencia entre esto y la página de Registros Clínicos?** Registros Clínicos es el índice a nivel de plantel; este es el archivo completo de un jugador. Abres un registro desde el índice.

**¿Esta página da orientación de tratamiento?** No — almacena y muestra los datos clínicos del jugador. Las decisiones clínicas quedan con el cuerpo médico.

## Relacionado

- [Registros Clínicos](/support/clinical-records) — el índice del plantel desde el que abres un registro.
- [Lesiones](/support/injuries) — las lesiones que también alimentan el mapa de calor y el historial.
- [Fisioterapia](/support/physio) — los tratamientos mostrados aquí en solo lectura.
- [Rehabilitación y Preventivos](/support/rehab) — programas de rehabilitación para el jugador.
