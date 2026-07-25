// ── Dualhook / Meta Cloud API ──────────────────────────────────────────────

export interface DualhookWebhookBody {
  object: string
  entry:  DualhookEntry[]
}

export interface DualhookEntry {
  id:      string
  changes: DualhookChange[]
}

export interface DualhookChange {
  value: DualhookValue
  field: string
}

export interface DualhookValue {
  messaging_product: string
  metadata:          { display_phone_number: string; phone_number_id: string }
  contacts?:         DualhookContact[]
  messages?:         DualhookMessage[]
  statuses?:         DualhookStatus[]
}

export interface DualhookContact {
  profile: { name: string }
  wa_id:   string
}

export interface DualhookMessage {
  from:      string
  id:        string
  timestamp: string
  type:      'text' | 'audio' | 'image' | 'document' | 'location' | 'interactive' | 'sticker' | 'video'
  text?:     { body: string }
  audio?:    { id: string; mime_type: string }
  image?:    { id: string; mime_type: string; caption?: string }
  document?: { id: string; mime_type: string; filename?: string; caption?: string }
  location?: { latitude: number; longitude: number; name?: string; address?: string }
  interactive?: {
    type:         'button_reply' | 'list_reply'
    button_reply?: { id: string; title: string }
    list_reply?:   { id: string; title: string; description?: string }
  }
}

export interface DualhookStatus {
  id:           string
  status:       'sent' | 'delivered' | 'read' | 'failed'
  timestamp:    string
  recipient_id: string
  errors?:      Array<{ code: number; title: string }>
}

// ── Envío de mensajes ──────────────────────────────────────────────────────

export interface SendResult {
  ok:            boolean
  messageId?:    string
  statusCode?:   number
  errorMessage?: string
  rawResponse?:  unknown
}

export interface SendTextOptions {
  to:       string
  text:     string
  preview?: boolean
}

export interface SendImageOptions {
  to:       string
  imageUrl: string
  caption?: string
}

export interface SendAudioOptions {
  to:       string
  audioUrl: string
}

export interface SendDocumentOptions {
  to:        string
  docUrl:    string
  filename?: string
  caption?:  string
}

export interface SendLocationOptions {
  to:       string
  lat:      number
  lng:      number
  name?:    string
  address?: string
}

// ── OpenAI ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role:    'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  messages:     ChatMessage[]
  model?:       string
  temperature?: number
  maxTokens?:   number
}

export interface ChatResult {
  ok:            boolean
  text?:         string
  errorMessage?: string
  usage?:        { promptTokens: number; completionTokens: number; totalTokens: number }
}

export interface TranscribeResult {
  ok:            boolean
  text?:         string
  errorMessage?: string
  errorCode?:    'too_large' | 'api_error' | 'download_error'
}
