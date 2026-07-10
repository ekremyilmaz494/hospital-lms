import { addSessionToTotal, type ScormVersion } from './timespan'

/**
 * Player'ın SCORM runtime adaptörü (SCORM 1.2 `window.API` + SCORM 2004
 * `window.API_1484_11`). Sunucuya yazılacak alanlar tek bir sözleşmede toplanır;
 * CMI eşlemesi saf fonksiyonlarda (test edilebilir) tutulur.
 *
 * Zaman birikimi İSTEMCİ tarafında SABİT taban ile yapılır (idempotent): oturum
 * başındaki total_time taban alınır, SCO'nun raporladığı session_time üstüne
 * eklenir → aynı session içinde tekrarlı commit çift saymaz.
 */

export interface ScormTrackingFields {
  lessonStatus?: string
  score?: number
  suspendData?: string
  totalTime?: string
  completionStatus?: string
  successStatus?: string
  lessonLocation?: string
}

export interface ScormRuntimeConfig {
  version: ScormVersion
  initial: {
    lessonStatus: string | null
    score: number | null
    totalTime: string | null
    suspendData: string | null
    completionStatus: string | null
    successStatus: string | null
    lessonLocation?: string | null
    studentId?: string
    studentName?: string
  }
  /** Debounce'lu kalıcılaştırma (sık set çağrıları). */
  onPersist: (fields: ScormTrackingFields) => void
  /** Anında flush (commit/finish). */
  onCommit: (fields: ScormTrackingFields) => void
  /** Tamamlandı sinyali (UI'ı "tamamlandı" ekranına geçir). */
  onComplete: () => void
}

type FieldKind = keyof ScormTrackingFields | 'sessionTime' | null

/**
 * Bir CMI anahtarının hangi tracking alanına düştüğünü döner (saf, test edilebilir).
 * `sessionTime` özel: değeri toplam süreye eklenip `totalTime` olarak yazılır.
 */
export function cmiKeyToTrackingField(version: ScormVersion, key: string): FieldKind {
  if (version === '2004') {
    switch (key) {
      case 'cmi.completion_status': return 'completionStatus'
      case 'cmi.success_status': return 'successStatus'
      case 'cmi.score.raw': return 'score'
      case 'cmi.score.scaled': return 'score'
      case 'cmi.suspend_data': return 'suspendData'
      case 'cmi.location': return 'lessonLocation'
      case 'cmi.session_time': return 'sessionTime'
      default: return null
    }
  }
  // SCORM 1.2
  switch (key) {
    case 'cmi.core.lesson_status': return 'lessonStatus'
    case 'cmi.core.score.raw': return 'score'
    case 'cmi.suspend_data': return 'suspendData'
    case 'cmi.core.lesson_location': return 'lessonLocation'
    case 'cmi.core.session_time': return 'sessionTime'
    default: return null
  }
}

/** Bir set çağrısının "tamamlandı" sinyali olup olmadığını döner (saf, test edilebilir). */
export function isCompletionSignal(version: ScormVersion, key: string, value: string): boolean {
  if (version === '2004') {
    if (key === 'cmi.completion_status') return value === 'completed'
    if (key === 'cmi.success_status') return value === 'passed'
    return false
  }
  return key === 'cmi.core.lesson_status' && (value === 'passed' || value === 'completed')
}

/** SCORM 1.2 API (window.API) arayüzü. */
export interface Scorm12Api {
  LMSInitialize: (p: string) => string
  LMSGetValue: (k: string) => string
  LMSSetValue: (k: string, v: string) => string
  LMSCommit: (p: string) => string
  LMSFinish: (p: string) => string
  LMSGetLastError: () => string
  LMSGetErrorString: (c: string) => string
  LMSGetDiagnostic: (c: string) => string
}

/** SCORM 2004 API (window.API_1484_11) arayüzü. */
export interface Scorm2004Api {
  Initialize: (p: string) => string
  GetValue: (k: string) => string
  SetValue: (k: string, v: string) => string
  Commit: (p: string) => string
  Terminate: (p: string) => string
  GetLastError: () => string
  GetErrorString: (c: string) => string
  GetDiagnostic: (c: string) => string
}

export interface CreatedScormApi {
  /** window'a takılacak global adı. */
  globalName: 'API' | 'API_1484_11'
  api: Scorm12Api | Scorm2004Api
}

/** Sürüme göre başlangıç CMI veri modelini (SCO'nun okuyacağı) üretir. */
function seedCmi(config: ScormRuntimeConfig): Record<string, string> {
  const { initial, version } = config
  const entry = initial.suspendData ? 'resume' : 'ab-initio'
  if (version === '2004') {
    return {
      'cmi.learner_id': initial.studentId ?? '',
      'cmi.learner_name': initial.studentName ?? '',
      'cmi.completion_status': initial.completionStatus || 'unknown',
      'cmi.success_status': initial.successStatus || 'unknown',
      'cmi.score.raw': initial.score?.toString() ?? '',
      'cmi.score.min': '0',
      'cmi.score.max': '100',
      'cmi.score.scaled': '',
      'cmi.total_time': initial.totalTime || 'PT0H0M0S',
      'cmi.session_time': 'PT0H0M0S',
      'cmi.location': initial.lessonLocation || '',
      'cmi.suspend_data': initial.suspendData || '',
      'cmi.entry': entry,
      'cmi.exit': '',
      'cmi.credit': 'credit',
      'cmi.mode': 'normal',
      'cmi.launch_data': '',
    }
  }
  return {
    'cmi.core.student_id': initial.studentId ?? '',
    'cmi.core.student_name': initial.studentName ?? '',
    'cmi.core.lesson_status': initial.lessonStatus || 'not attempted',
    'cmi.core.score.raw': initial.score?.toString() ?? '',
    'cmi.core.score.min': '0',
    'cmi.core.score.max': '100',
    'cmi.core.total_time': initial.totalTime || '0000:00:00',
    'cmi.core.session_time': '00:00:00',
    'cmi.core.lesson_location': initial.lessonLocation || '',
    'cmi.core.entry': entry,
    'cmi.core.exit': '',
    'cmi.core.credit': 'credit',
    'cmi.core.lesson_mode': 'normal',
    'cmi.suspend_data': initial.suspendData || '',
    'cmi.launch_data': '',
  }
}

/**
 * Bir SCORM runtime adaptörü oluşturur. `globalName`'i player window'a takar.
 * Tüm set/commit/finish davranışı sürümden bağımsız tek çekirdekten türetilir.
 */
export function createScormApi(config: ScormRuntimeConfig): CreatedScormApi {
  const cmi = seedCmi(config)
  // Bu oturumun başındaki birikmiş toplam — sabit taban (idempotent birikim).
  const baseTotal = config.initial.totalTime

  const applySet = (key: string, value: string): void => {
    cmi[key] = value
    const kind = cmiKeyToTrackingField(config.version, key)
    if (kind) {
      const fields: ScormTrackingFields = {}
      if (kind === 'score') {
        // 2004 scaled (0-1) → 0-100; ham skor doğrudan.
        const num = parseFloat(value)
        fields.score = key.endsWith('scaled') ? Math.round((num || 0) * 100) : num || 0
      } else if (kind === 'sessionTime') {
        fields.totalTime = addSessionToTotal(baseTotal, value, config.version)
      } else {
        fields[kind] = value
      }
      config.onPersist(fields)
    }
    if (isCompletionSignal(config.version, key, value)) {
      config.onComplete()
    }
  }

  const snapshot = (): ScormTrackingFields => {
    const v = config.version
    const get = (k: string) => cmi[k] ?? ''
    if (v === '2004') {
      return {
        completionStatus: get('cmi.completion_status') || undefined,
        successStatus: get('cmi.success_status') || undefined,
        score: get('cmi.score.raw') ? parseFloat(get('cmi.score.raw')) || 0 : undefined,
        suspendData: get('cmi.suspend_data') || undefined,
        lessonLocation: get('cmi.location') || undefined,
        totalTime: addSessionToTotal(baseTotal, get('cmi.session_time'), v),
      }
    }
    return {
      lessonStatus: get('cmi.core.lesson_status') || undefined,
      score: get('cmi.core.score.raw') ? parseFloat(get('cmi.core.score.raw')) || 0 : undefined,
      suspendData: get('cmi.suspend_data') || undefined,
      lessonLocation: get('cmi.core.lesson_location') || undefined,
      totalTime: addSessionToTotal(baseTotal, get('cmi.core.session_time'), v),
    }
  }

  if (config.version === '2004') {
    const api: Scorm2004Api = {
      Initialize: () => 'true',
      GetValue: (k) => cmi[k] ?? '',
      SetValue: (k, v) => { applySet(k, v); return 'true' },
      Commit: () => { config.onCommit(snapshot()); return 'true' },
      Terminate: () => { config.onCommit(snapshot()); return 'true' },
      GetLastError: () => '0',
      GetErrorString: () => '',
      GetDiagnostic: () => '',
    }
    return { globalName: 'API_1484_11', api }
  }

  const api: Scorm12Api = {
    LMSInitialize: () => 'true',
    LMSGetValue: (k) => cmi[k] ?? '',
    LMSSetValue: (k, v) => { applySet(k, v); return 'true' },
    LMSCommit: () => { config.onCommit(snapshot()); return 'true' },
    LMSFinish: () => { config.onCommit(snapshot()); return 'true' },
    LMSGetLastError: () => '0',
    LMSGetErrorString: () => '',
    LMSGetDiagnostic: () => '',
  }
  return { globalName: 'API', api }
}
