# Promo Pool — puesta en marcha

Sistema propio de envío de promos: landing privada por contacto, envío desde
dominio autenticado, y métricas reales de escucha, descarga y feedback.

Coste total: **0 €/mes** en los planes gratuitos de Neon, Resend, Cloudinary y
GitHub Actions.

---

## Paso 0 — Base de datos: nada que hacer

La base de datos **ya está en Neon** (`ep-twilight-mouse-...aws.neon.tech`), cuyo
plan gratuito es permanente y no caduca. El comentario de
`server/src/db/database.ts` sobre "la base de datos gratuita de Render" es
histórico: la migración ya se hizo en su momento.

Las 6 tablas `promo_*` se crean solas al arrancar, vía `initDb()`. Ya se
verificaron contra la base real: los datos existentes (4 artistas, 10 releases)
quedaron intactos.

Como copia de seguridad periódica: **Admin → Promo Pool → Contacts → Export CSV**.

---

## Paso 1 — Resend y DNS

Este es el paso que arregla el problema de spam. **No es opcional ni
automatizable**: firmar el dominio criptográficamente es justo lo que falta hoy.

1. Cuenta en [resend.com](https://resend.com) → API Keys → crear una.
2. Domains → Add Domain → `criminalcrisis.com`.
3. Resend muestra **3 registros DNS** (SPF, DKIM y DMARC). Pegarlos en el panel
   DNS del dominio. Tarda entre minutos y una hora en propagar.
4. Pulsar **Verify** hasta que los tres queden en verde.
5. Webhooks → Add Endpoint → `https://<API>/api/promo/webhook/resend`,
   con los eventos `email.delivered`, `email.bounced`, `email.complained`.
   Copiar el signing secret (`whsec_…`).

> El webhook no es un extra: es lo que suprime automáticamente rebotes y quejas.
> Seguir enviando a direcciones que rebotan es la forma más rápida de arruinar la
> reputación del dominio y volver a spam.

---

## Paso 2 — Variables de entorno en Render

```
SITE_URL=https://criminalcrisis.com
PUBLIC_API_URL=https://criminalcrisis.onrender.com
DATABASE_URL=<el de Neon>
JWT_SECRET=<generar, ver abajo>

RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
PROMO_FROM_EMAIL=promos@criminalcrisis.com
PROMO_FROM_NAME=Criminal Crisis
PROMO_REPLY_TO=info@criminalcrisis.com
PROMO_DAILY_CAP=100
PROMO_CRON_SECRET=<generar>
```

Generar los secretos:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**`JWT_SECRET` ahora es obligatorio en producción.** Antes había un valor por
defecto escrito en el repositorio, lo que permitía a cualquiera que lo leyera
generar tokens de admin válidos. Con datos personales de 350 contactos detrás,
eso ya no era aceptable: el servidor se niega a arrancar sin él.

---

## Paso 3 — El goteo automático

En GitHub → Settings → Secrets and variables → Actions:

| Secret | Valor |
|---|---|
| `PROMO_API_URL` | `https://criminalcrisis.onrender.com` |
| `PROMO_CRON_SECRET` | el mismo que en Render |

`.github/workflows/promo-drip.yml` se ejecuta cada hora y envía el siguiente
lote pendiente respetando `PROMO_DAILY_CAP`. También se puede lanzar a mano desde
la pestaña Actions.

**Por qué a goteo y no todo de golpe:** 350 envíos el primer día desde un dominio
sin historial es una señal clásica de spam. 100/día durante 4 días es una curva de
calentamiento correcta. Cuando el dominio tenga rodaje, subir `PROMO_DAILY_CAP`
(requiere plan de pago en Resend, 20 $/mes para 50.000 envíos).

---

## Paso 4 — Prueba end-to-end antes de tocar la lista real

1. Admin → Promo Pool → **Campaigns** → New campaign. Título, asunto, nota de
   prensa, fecha de embargo y artwork.
2. Añadir tracks. El archivo de streaming se transcodifica a 128 kbps
   automáticamente; subir un máster (WAV/320) solo si se quiere que descarguen
   más calidad.
3. **Contacts** → añadir 2 o 3 direcciones propias (Gmail, Outlook, Yahoo).
4. Volver a la campaña → Recipients → Add recipients.
5. **Send test** a una dirección propia y comprobar en
   [mail-tester.com](https://www.mail-tester.com). Objetivo: **9/10 o más**.
6. Abrir el enlace personal → escuchar → descargar → dejar feedback.
7. Comprobar en **Results** que aparecen visita, reproducción, descarga y
   comentario.
8. Probar el enlace de baja y confirmar que el contacto pasa a `unsubscribed`.

Solo después: importar los 350 contactos reales y enviar.

---

## Importar la lista

CSV con una columna `email`. Se reconocen también `name`, `role`, `country`,
`company` y `tags`, con alias en español e inglés (`nombre`, `empresa`, `país`,
`correo`…). Los emails ya existentes se actualizan, nunca se duplican.

---

## Detalles de diseño que conviene no deshacer

- **`List-Unsubscribe` + `List-Unsubscribe-Post`** (RFC 8058). Gmail y Yahoo los
  exigen a quien envía en volumen desde febrero de 2024. Sin ellos, spam directo.
- **Parte de texto plano** junto a la HTML. El HTML a secas puntúa peor en todos
  los filtros.
- **Emails ligeros de imágenes y sin acortadores de enlaces**, por el mismo motivo.
- **El audio se sube como `authenticated` en Cloudinary**, no público. Las URLs se
  firman en cada petición y solo después de validar el token del destinatario.
  Nunca se guarda una URL reproducible en base de datos.
- **El tracking se basa en visitas y reproducciones, no en aperturas.** Apple Mail
  Privacy Protection precarga las imágenes desde 2021, así que las aperturas son
  ruido. Se registran, pero no sirven para decidir nada.

## Riesgo a vigilar: ancho de banda de Cloudinary

El plan gratuito son ~25 GB/mes compartidos con las imágenes del sitio. Por eso el
streaming va a 128 kbps (~4 MB por track) y la alta calidad solo se sirve al pulsar
descargar. Si se queda corto, la salida natural es **Cloudflare R2**: 10 GB de
almacenamiento y **egress gratis**, con API compatible con S3.
