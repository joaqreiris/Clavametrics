# CLAUDE CODE OPTIMIZATION RULES

## PRINCIPIO GENERAL

Trabaja siempre con máxima eficiencia de contexto y mínimo consumo de tokens.

Nunca rehagas análisis ya realizados.
Nunca releas archivos innecesarios.
Nunca expliques más de lo necesario.
Prioriza modificaciones quirúrgicas y modulares.

---

# 1. REGLAS DE CONTEXTO

## 1.1 Nunca analizar el proyecto completo nuevamente

NO volver a escanear todo el repositorio si ya existe contexto suficiente.

Solo leer:
- archivos directamente relacionados
- imports relevantes
- componentes conectados
- utilidades compartidas necesarias

Evitar:
- análisis globales repetitivos
- listar estructuras completas
- reindexar carpetas enteras

---

## 1.2 Mantener contexto pequeño

Trabajar únicamente sobre:
- 1 módulo
- 1 página
- 1 feature
- 1 flujo

por sesión cuando sea posible.

---

## 1.3 Evitar respuestas largas

Responder corto y técnico.

NO explicar:
- conceptos básicos
- HTML/CSS trivial
- funcionamiento general de JavaScript
- Supabase básico

A menos que se solicite explícitamente.

---

# 2. REGLAS DE MODIFICACIÓN

## 2.1 Nunca reescribir archivos completos

Modificar únicamente:
- funciones necesarias
- bloques específicos
- secciones afectadas

Preservar:
- estilos existentes
- estructura visual
- naming actual
- arquitectura existente

---

## 2.2 NO tocar CSS salvo indicación explícita

El diseño visual debe preservarse.

NO:
- cambiar spacing
- cambiar colores
- cambiar tipografía
- rehacer layouts

salvo petición directa.

---

## 2.3 Mantener compatibilidad total

Toda modificación debe:
- respetar Supabase existente
- respetar tablas SQL existentes
- reutilizar utilidades compartidas
- reutilizar auth existente

---

# 3. REGLAS DE TOKENS

## 3.1 Minimizar lectura de archivos

Antes de abrir archivos:
Preguntar internamente:
- "¿Realmente necesito leer esto?"

NO abrir:
- archivos irrelevantes
- assets grandes
- archivos no relacionados

---

## 3.2 Evitar agentes paralelos innecesarios

NO lanzar múltiples agentes simultáneos salvo necesidad crítica.

Máximo recomendado:
- 1 o 2 agentes

---

## 3.3 No repetir contexto

NO repetir:
- resúmenes largos
- análisis previos
- arquitectura ya conocida

Asumir continuidad técnica.

---

## 3.4 No generar código redundante

Reutilizar:
- utilidades
- componentes
- helpers
- patrones existentes

antes de crear nuevos.

---

# 4. REGLAS DE ARQUITECTURA

## 4.1 Priorizar reutilización

Usar primero:
- supabase-init.js
- helpers existentes
- componentes compartidos
- variables CSS existentes

---

## 4.2 Mantener naming consistente

NO inventar nuevos patrones de nombres.

Seguir:
- naming actual
- convenciones existentes
- estructura existente

---

## 4.3 Mantener modularidad

Cada feature debe ser:
- independiente
- mantenible
- fácilmente migrable

Evitar lógica gigante en un solo archivo.

---

# 5. REGLAS DE RESPUESTA

## 5.1 Respuestas cortas

Formato ideal:
- qué se hizo
- archivos modificados
- problemas encontrados
- siguiente paso

NO generar documentación extensa salvo solicitud.

---

## 5.2 Priorizar acción sobre explicación

Invertir más tokens en:
- código
- soluciones
- fixes

y menos en:
- explicaciones
- teoría
- descripciones innecesarias

---

# 6. REGLAS DE SESIÓN

## 6.1 Recomendar nueva sesión si:

- contexto > 120k tokens
- múltiples módulos mezclados
- degradación de precisión
- demasiados archivos abiertos

---

## 6.2 Trabajar por módulos

Separar sesiones por:
- auth
- dashboard
- GPS
- wellness
- injuries
- planner
- analytics

---

# 7. REGLAS PARA SUPABASE

## 7.1 Nunca hardcodear datos falsos

Todos los datos deben venir:
- de Supabase
- o de mocks claramente marcados

---

## 7.2 Mantener auth consistente

Usar siempre:
- requireAuth()
- getProfile()
- getClub()
- getClubId()

si ya existen.

---

# 8. REGLAS DE PERFORMANCE

## 8.1 Minimizar dependencias nuevas

NO instalar:
- frameworks innecesarios
- librerías pesadas
- duplicados funcionales

---

## 8.2 Mantener JS liviano

Priorizar:
- JS vanilla existente
- helpers simples
- funciones reutilizables

---

# 9. REGLAS CRÍTICAS

## 9.1 Nunca asumir estructura sin verificar

Antes de modificar:
- verificar imports
- verificar nombres reales
- verificar rutas reales

---

## 9.2 Nunca romper código existente

Prioridad absoluta:
- estabilidad
- compatibilidad
- continuidad visual

---

# 10. FORMATO IDEAL DE TRABAJO

Para cada tarea:

1. Leer mínimo contexto necesario
2. Identificar archivos exactos
3. Modificar quirúrgicamente
4. Reutilizar patrones existentes
5. Validar compatibilidad
6. Responder corto

---

# OBJETIVO FINAL

Maximizar:
- precisión
- velocidad
- continuidad arquitectónica

Minimizando:
- tokens
- relectura
- contexto innecesario
- cambios redundantes