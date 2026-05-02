'use client';

import { FileQuestion, Plus, Target, Trash2, CheckCircle2, Sparkles, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AiQuestionGenerator from '@/components/admin/trainings/ai-question-generator';
import { K, distributePoints, minCorrectForPassing, type QuestionItem, type VideoItem } from './types';

interface QuestionsStepProps {
  questions: QuestionItem[];
  setQuestions: React.Dispatch<React.SetStateAction<QuestionItem[]>>;
  passingScore: number;
  setPassingScore: (v: number) => void;
  addQuestion: () => void;
  removeQuestion: (id: number) => void;
  videos: VideoItem[];
}

export default function QuestionsStep({
  questions, setQuestions,
  passingScore, setPassingScore,
  addQuestion, removeQuestion,
  videos,
}: QuestionsStepProps) {
  const handleAiAdd = (
    items: { text: string; options: string[]; correct: number }[],
  ) => {
    setQuestions((prev) => {
      // Boş initial soruyu (text=='' && correct==-1) drop et — admin AI ile başlıyorsa.
      const cleaned = prev.filter((q) => q.text.trim() !== '' || q.correct !== -1 || q.options.some((o) => o.trim() !== ''));
      const baseId = cleaned.reduce((max, q) => Math.max(max, q.id), 0);
      const mapped: QuestionItem[] = items.map((it, i) => ({
        id: baseId + 1 + i,
        text: it.text,
        points: 0, // distributePoints will recompute on submit
        options: [it.options[0] ?? '', it.options[1] ?? '', it.options[2] ?? '', it.options[3] ?? ''],
        correct: it.correct,
        aiGenerated: true,
      }));
      const next = [...cleaned, ...mapped];
      // Puanları yeniden dağıt — toplam 100 olacak şekilde.
      const dist = distributePoints(next.length);
      return next.map((q, i) => ({ ...q, points: dist[i] ?? 0 }));
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#fef3c7' }}>
            <FileQuestion className="h-5 w-5" style={{ color: K.WARNING }} />
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ fontFamily: K.FONT_DISPLAY }}>Sınav Soruları</h3>
            <p className="text-xs" style={{ color: K.TEXT_MUTED }}>
              {questions.length} soru • Her soru eşit puan değerinde (otomatik dağıtılır — toplam 100)
            </p>
          </div>
        </div>
      </div>

      <div
        className="rounded-xl p-5"
        style={{ background: K.BG, border: `1.5px solid ${K.BORDER}` }}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <Target className="h-4 w-4" style={{ color: K.PRIMARY }} />
          <Label className="text-sm font-semibold" style={{ color: K.TEXT_PRIMARY }}>Baraj Puanı</Label>
          <span className="text-[11px]" style={{ color: K.TEXT_MUTED }}>(100 üzerinden)</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr] sm:items-center">
          <Input
            type="number"
            min={0}
            max={100}
            value={passingScore}
            onChange={(e) => setPassingScore(Number(e.target.value))}
            className="h-11 text-center text-base font-bold"
            style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }}
          />
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{
              background: K.PRIMARY_LIGHT,
              color: K.PRIMARY_HOVER,
              border: `1.5px dashed ${K.PRIMARY}`,
            }}
          >
            {questions.length > 0 && passingScore > 0 ? (
              <>
                Personel barajı geçmek için{' '}
                <strong style={{ color: K.PRIMARY }}>{questions.length}</strong> sorudan en az{' '}
                <strong style={{ color: K.PRIMARY, fontSize: '1.05em' }}>
                  {minCorrectForPassing(passingScore, questions.length)}
                </strong>{' '}
                tanesini doğru cevaplamalı.
              </>
            ) : (
              <span style={{ color: K.TEXT_MUTED }}>
                Soru ekledikçe ve baraj puanı girdikçe burada kaç doğru gerektiği gösterilecek.
              </span>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="manual" className="w-full flex-col gap-4">
        <TabsList className="w-full h-11 p-1 bg-stone-100">
          <TabsTrigger value="manual" className="h-9 text-sm font-semibold">
            <Pencil className="h-3.5 w-3.5" />
            Manuel
          </TabsTrigger>
          <TabsTrigger value="ai" className="h-9 text-sm font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            Yapay Zeka ile Üret
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="pt-4">
          <div className="flex justify-end mb-4">
            <Button
              onClick={addQuestion}
              className="gap-2 font-semibold text-white rounded-xl"
              style={{ background: K.WARNING, transition: 'opacity 150ms ease' }}
            >
              <Plus className="h-4 w-4" /> Soru Ekle
            </Button>
          </div>

          <div className="space-y-4">
            {questions.map((q, qIdx) => (
              <div
                key={q.id}
                className="rounded-xl border"
                style={{ borderColor: K.BORDER, background: K.BG }}
              >
                <div
                  className="flex items-center gap-3 px-5 py-3.5"
                  style={{ borderBottom: `1.5px solid ${K.BORDER}`, background: K.SURFACE }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ background: K.WARNING }}
                  >
                    {qIdx + 1}
                  </div>
                  <Input
                    value={q.text}
                    onChange={(e) => setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, text: e.target.value } : pq))}
                    placeholder="Soruyu yazın..."
                    className="flex-1 h-9 border-0 bg-transparent text-sm font-medium focus-visible:ring-0 px-0"
                    style={{ color: K.TEXT_PRIMARY }}
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    {q.aiGenerated && (
                      <span
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold"
                        style={{ background: K.PRIMARY_LIGHT, color: K.PRIMARY_HOVER }}
                        title="Bu soru AI tarafından üretildi"
                      >
                        <Sparkles className="h-3 w-3" /> AI
                      </span>
                    )}
                    <span
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold"
                      style={{
                        background: '#fef3c7',
                        color: K.WARNING,
                        fontFamily: K.FONT_MONO,
                      }}
                      title="Puan otomatik hesaplanır — 100 / soru sayısı"
                    >
                      {distributePoints(questions.length)[qIdx] ?? 0} puan
                    </span>
                    <button
                      onClick={() => removeQuestion(q.id)}
                      className="rounded-lg p-1.5"
                      style={{ color: K.ERROR, transition: 'opacity 150ms ease' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-2.5">
                  {['A', 'B', 'C', 'D'].map((opt, optIdx) => (
                    <label
                      key={opt}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer"
                      style={{
                        border: `1.5px solid ${q.correct === optIdx ? K.SUCCESS : K.BORDER}`,
                        background: q.correct === optIdx ? K.SUCCESS_BG : K.SURFACE,
                        transition: 'border-color 150ms ease, background 150ms ease',
                      }}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        className="h-4 w-4"
                        style={{ accentColor: K.SUCCESS }}
                        checked={q.correct === optIdx}
                        onChange={() => {
                          setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, correct: optIdx } : pq));
                        }}
                      />
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold"
                        style={{
                          background: q.correct === optIdx ? K.SUCCESS : K.BG_SOFT,
                          color: q.correct === optIdx ? 'white' : K.TEXT_MUTED,
                        }}
                      >
                        {opt}
                      </span>
                      <Input
                        value={q.options[optIdx]}
                        onChange={(e) => setQuestions(prev => prev.map(pq => {
                          if (pq.id === q.id) {
                            const newOptions = [...pq.options];
                            newOptions[optIdx] = e.target.value;
                            return { ...pq, options: newOptions };
                          }
                          return pq;
                        }))}
                        placeholder={`Şık ${opt}`}
                        className="flex-1 h-8 border-0 bg-transparent text-sm focus-visible:ring-0 px-0"
                        style={{ color: K.TEXT_PRIMARY }}
                      />
                    </label>
                  ))}
                  <p className="text-[11px] pl-1" style={{ color: K.TEXT_MUTED }}>
                    <CheckCircle2 className="h-3 w-3 inline mr-1" style={{ color: K.SUCCESS }} />
                    Doğru cevabı seçmek için tıklayın
                  </p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ai" className="pt-4">
          <AiQuestionGenerator
            videos={videos}
            onAdd={handleAiAdd}
            manualQuestions={questions
              .filter((q) => q.text.trim() !== '' && q.options.some((o) => o.trim() !== ''))
              .map((q) => ({ text: q.text }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
