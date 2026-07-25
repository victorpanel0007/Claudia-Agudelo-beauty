# Diagnóstico y Verificación del Módulo WhatsApp (DualHook)

## URL del Webhook de Producción

```
https://claudia-beauty-backend-production.up.railway.app/webhooks/dualhook
```

Esta es la única URL que DualHook debe usar. **No** usar la URL del SPA (`/api/whatsapp/webhook`).

---

## Variables de entorno requeridas en Railway

| Variable | Descripción | Valor por defecto (NO usar en prod) |
|---|---|---|
| `DUALHOOK_API_KEY` | API Key de DualHook | ❌ Obligatoria |
| `DUALHOOK_PHONE_NUMBER_ID` | Phone Number ID de Meta | ❌ Obligatoria |
| `DUALHOOK_VERIFY_TOKEN` | Token para verificación del webhook | `changeme` |
| `DUALHOOK_WEBHOOK_SECRET` | Secret para firma HMAC (opcional) | `changeme` |
| `OPENAI_API_KEY` | API Key de OpenAI | ❌ Obligatoria |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de Supabase | ❌ Obligatoria |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key de Supabase | ❌ Obligatoria |

---

## Paso 1 — Verificar que el backend está activo

```bash
curl https://claudia-beauty-backend-production.up.railway.app/health
```

Respuesta esperada:
```json
{
  "ok": true,
  "service": "claudia-beauty-backend",
  "supabase": "connected",
  "dualhook_configured": true,
  "openai_configured": true
}
```

---

## Paso 2 — Verificar estado de variables de entorno

```bash
curl https://claudia-beauty-backend-production.up.railway.app/api/test/config
```

Confirma que DualHook, OpenAI y Supabase están configurados.

---

## Paso 3 — Verificar el handshake del webhook con DualHook

```bash
curl "https://claudia-beauty-backend-production.up.railway.app/webhooks/dualhook?hub.mode=subscribe&hub.verify_token=TU_VERIFY_TOKEN&hub.challenge=test123"
```

Respuesta esperada: `test123` (el challenge de vuelta, HTTP 200)

---

## Paso 4 — Probar el bot sin necesitar WhatsApp (simular mensaje entrante)

```bash
curl -X POST https://claudia-beauty-backend-production.up.railway.app/api/test/bot \
  -H "Content-Type: application/json" \
  -d '{"telefono": "573001234567", "mensaje": "Hola"}'
```

Respuesta esperada:
```json
{ "ok": true, "message": "Bot procesó el mensaje. Revisa los logs para ver el flujo completo." }
```

**Revisar logs en Railway** — deben aparecer:
- `[BotEngine] 🤖 Iniciando processBotMessage`
- `[BotEngine] Palabra de reinicio detectada — mostrando menú principal`
- `[BotEngine] 📤 Enviando respuesta al cliente`
- `[WhatsApp] Texto enviado` ← confirma que DualHook recibió la respuesta

---

## Paso 5 — Probar envío directo a un número real

```bash
curl -X POST https://claudia-beauty-backend-production.up.railway.app/api/test/send \
  -H "Content-Type: application/json" \
  -d '{"telefono": "573001234567", "mensaje": "Prueba de envío desde backend"}'
```

---

## Paso 6 — Simular el webhook de DualHook (mensaje entrante real)

```bash
curl -X POST https://claudia-beauty-backend-production.up.railway.app/webhooks/dualhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "ENTRY_ID",
      "changes": [{
        "field": "messages",
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "573001234567",
            "phone_number_id": "TU_PHONE_NUMBER_ID"
          },
          "contacts": [{
            "profile": { "name": "Cliente Prueba" },
            "wa_id": "573009876543"
          }],
          "messages": [{
            "from": "573009876543",
            "id": "test-msg-001",
            "timestamp": "1700000000",
            "type": "text",
            "text": { "body": "Hola" }
          }]
        }
      }]
    }]
  }'
```

Respuesta esperada: `{"status":"ok"}` (HTTP 200 inmediato)

Los logs de Railway deben mostrar el flujo completo:
1. `📥 Payload COMPLETO recibido de DualHook`
2. `✅ Formato Meta Cloud API reconocido`
3. `📨 Mensaje entrante detectado`
4. `🚀 Enviando a processIncomingMessage`
5. `🤖 Iniciando processBotMessage`
6. `📤 Enviando respuesta al cliente`
7. `✅ Mensaje procesado correctamente`

---

## Causas raíz identificadas y corregidas

### Bug 1 — Comparación incorrecta del número propio
**Antes:** `msg.from === process.env.DUALHOOK_PHONE_NUMBER_ID`
- `DUALHOOK_PHONE_NUMBER_ID` es el ID numérico de Meta (ej: `123456789012345`)
- `msg.from` es el número de teléfono (ej: `573001234567`)
- Nunca coinciden → potencial confusión en el flujo

**Después:** Solo se compara cuando el admin responde manualmente desde el número configurado.

### Bug 2 — Payload de DualHook rechazado silenciosamente
**Antes:** Si `body.object !== 'whatsapp_business_account'`, el webhook retornaba sin hacer nada y sin ningún log.

**Después:** Se loggea el payload completo y se intenta parsear formatos alternativos que DualHook pueda enviar.

### Bug 3 — Logs insuficientes
**Antes:** Errores en `processIncomingMessage` y `processBotMessage` se tragaban silenciosamente.

**Después:** Logs detallados en cada paso del flujo con stack traces completos.

### Bug 4 — URL del webhook incorrecta en el panel de admin
**Antes:** El panel mostraba `https://midominio.com/api/whatsapp/webhook` (endpoint del SPA, formato Evolution API).

**Después:** Muestra la URL correcta del backend Railway: `https://claudia-beauty-backend-production.up.railway.app/webhooks/dualhook`.

---

## Archivos modificados (solo módulo WhatsApp)

1. `backend/src/controllers/webhook.controller.ts` — Logs completos, soporte formato alternativo, fix comparación phone_number_id
2. `backend/src/controllers/health.controller.ts` — Endpoints de diagnóstico: `/api/test/bot`, `/api/test/send`, `/api/test/config`
3. `backend/src/routes/index.ts` — Registro de nuevos endpoints de diagnóstico
4. `backend/src/services/message.processor.ts` — Logs detallados con stack traces
5. `backend/src/services/bot.engine.ts` — Logs en cada punto del flujo (recepción, OpenAI, respuesta)
6. `src/components/admin/WhatsAppAdminView.tsx` — URL webhook corregida, referencias Evolution API eliminadas

**NO se modificó:** agenda, citas, clientes, servicios, especialistas, reportes, comisiones, dashboard, base de datos, diseño, autenticación.
