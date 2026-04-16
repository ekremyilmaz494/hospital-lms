'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, FileQuestion, ChevronDown, ChevronRight, BookOpen } from 'lucide-react'

interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: number
  explanation?: string
}

interface QuizItem {
  id: string
  title: string
  category: string
  contentData: { questions?: QuizQuestion[] } | null
  createdAt: string
}

interface WizardQuestion {
  id: number
  text: string
  points: number
  options: string[]
  correct: number
}

interface LibraryQuestionPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (questions: WizardQuestion[]) => void
}

/** NotebookLM quiz verisi farklı formatlarda gelebilir — normalize et */
function normalizeQuestions(raw: Record<string, unknown>): QuizQuestion[] {
  const questions: QuizQuestion[] = []
  const rawQuestions = (raw.questions ?? raw.quiz ?? []) as Record<string, unknown>[]

  for (const q of rawQuestions) {
    const questionText = (q.question ?? q.questionText ?? q.text ?? '') as string
    if (!questionText) continue

    let options: string[] = []
    let correctAnswer = 0

    // Format 1: options: string[], correctAnswer: number
    if (Array.isArray(q.options) && typeof q.options[0] === 'string') {
      options = q.options as string[]
      correctAnswer = typeof q.correctAnswer === 'number' ? q.correctAnswer : 0
    }
    // Format 2: answerOptions: [{ text, isCorrect }]
    else if (Array.isArray(q.answerOptions)) {
      const ansOpts = q.answerOptions as { text: string; isCorrect?: boolean }[]
      options = ansOpts.map(o => o.text)
      correctAnswer = ansOpts.findIndex(o => o.isCorrect === true)
      if (correctAnswer < 0) correctAnswer = 0
    }
    // Format 3: options: [{ text, isCorrect }]
    else if (Array.isArray(q.options) && typeof q.options[0] === 'object') {
      const opts = q.options as { text: string; isCorrect?: boolean }[]
      options = opts.map(o => o.text)
      correctAnswer = opts.findIndex(o => o.isCorrect === true)
      if (correctAnswer < 0) correctAnswer = 0
    }

    if (options.length >= 2) {
      questions.push({ question: questionText, options, correctAnswer })
    }
  }

  return questions
}

function padOptions(options: string[], min: number = 4): string[] {
  if (options.length >= min) return options.slice(0, min)
  return [...options, ...Array(min - options.length).fill('')]
}

export function LibraryQuestionPicker({ open, onOpenChange, onSelect }: LibraryQuestionPickerProps) {
  const [items, setItems] = useState<QuizItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Selection: quizId:questionIndex
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: 'quiz' })
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/content-library/ai-items?${params}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    if (open) {
      fetchItems()
      setSelected(new Set())
      setExpanded(new Set())
    }
  }, [open, fetchItems])

  const getQuestions = (item: QuizItem): QuizQuestion[] => {
    if (!item.contentData) return []
    return normalizeQuestions(item.contentData as Record<string, unknown>)
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleQuestion = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAllQuestions = (item: QuizItem) => {
    const questions = getQuestions(item)
    const keys = questions.map((_, i) => `${item.id}:${i}`)
    const allSelected = keys.every(k => selected.has(k))

    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) {
        keys.forEach(k => next.delete(k))
      } else {
        keys.forEach(k => next.add(k))
      }
      return next
    })
  }

  const handleConfirm = () => {
    const result: WizardQuestion[] = []
    let counter = Date.now()

    for (const item of items) {
      const questions = getQuestions(item)
      questions.forEach((q, i) => {
        const key = `${item.id}:${i}`
        if (selected.has(key)) {
          result.push({
            id: counter++,
            text: q.question,
            points: 10,
            options: padOptions(q.options),
            correct: q.correctAnswer,
          })
        }
      })
    }

    onSelect(result)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Kütüphaneden Soru Ekle</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
          <Input
            placeholder="Quiz ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchItems()}
            className="pl-9"
          />
        </div>

        {/* Quiz Items */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12" style={{ color: 'var(--color-text-muted)' }}>
              Yükleniyor...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: 'var(--color-text-muted)' }}>
              <BookOpen className="h-10 w-10 mb-2 opacity-40" />
              <p>Kütüphanede quiz bulunamadı</p>
              <p className="text-sm">AI İçerik Stüdyosu&apos;ndan quiz üretip kütüphaneye kaydedin.</p>
            </div>
          ) : (
            items.map(item => {
              const questions = getQuestions(item)
              const isExpanded = expanded.has(item.id)
              const keys = questions.map((_, i) => `${item.id}:${i}`)
              const selectedCount = keys.filter(k => selected.has(k)).length
              const allSelected = questions.length > 0 && selectedCount === questions.length

              return (
                <div
                  key={item.id}
                  className="border rounded-xl overflow-hidden"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  {/* Quiz header */}
                  <div className="flex items-center gap-3 p-3" style={{ background: 'var(--color-surface)' }}>
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={() => toggleAllQuestions(item)}
                    />
                    <button
                      type="button"
                      className="flex-1 flex items-center gap-2 text-left"
                      onClick={() => toggleExpand(item.id)}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <FileQuestion className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                      <span className="font-medium" style={{ color: 'var(--color-text)' }}>{item.title}</span>
                    </button>
                    <Badge variant="secondary" className="text-xs">
                      {questions.length} soru
                    </Badge>
                    {selectedCount > 0 && (
                      <Badge className="text-xs">{selectedCount} seçili</Badge>
                    )}
                  </div>

                  {/* Questions list */}
                  {isExpanded && questions.length > 0 && (
                    <div className="border-t divide-y" style={{ borderColor: 'var(--color-border)' }}>
                      {questions.map((q, i) => {
                        const key = `${item.id}:${i}`
                        return (
                          <label
                            key={key}
                            className="flex items-start gap-3 p-3 cursor-pointer hover:bg-black/[0.02] transition-colors"
                          >
                            <Checkbox
                              checked={selected.has(key)}
                              onCheckedChange={() => toggleQuestion(key)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                                <span className="font-medium mr-1">S{i + 1}.</span>
                                {q.question}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {q.options.map((opt, oi) => (
                                  <span
                                    key={oi}
                                    className="text-xs px-1.5 py-0.5 rounded"
                                    style={{
                                      background: oi === q.correctAnswer
                                        ? 'var(--color-primary-light, color-mix(in srgb, var(--brand-600) calc(0.1 * 100%), transparent))'
                                        : 'var(--color-muted, rgba(0,0,0,0.04))',
                                      color: oi === q.correctAnswer
                                        ? 'var(--color-primary)'
                                        : 'var(--color-text-muted)',
                                      fontWeight: oi === q.correctAnswer ? 600 : 400,
                                    }}
                                  >
                                    {String.fromCharCode(65 + oi)}) {opt}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {selected.size > 0 ? `${selected.size} soru seçildi` : 'Soru seçin'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button onClick={handleConfirm} disabled={selected.size === 0}>
              Soruları Ekle ({selected.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
