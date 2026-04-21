// Clinical Editorial palette — login page ile aynı renkler
const CREAM = '#faf7f2'
const RULE = '#e5e0d5'

export default function Loading() {
  return (
    <div className="flex min-h-screen" style={{ background: CREAM }}>
      {/* Sol panel skeleton — editorial cream, nötr gri shimmer */}
      <div
        className="hidden lg:flex lg:w-[55%] flex-col justify-between p-12 xl:p-16"
        style={{ background: CREAM, borderRight: `1px solid ${RULE}` }}
      >
        <div className="h-8 w-40 rounded-sm" style={{ background: RULE, opacity: 0.6 }} />
        <div className="space-y-4">
          <div className="h-14 w-[80%] rounded-sm" style={{ background: RULE, opacity: 0.5 }} />
          <div className="h-14 w-[60%] rounded-sm" style={{ background: RULE, opacity: 0.5 }} />
          <div className="h-4 w-[70%] mt-4 rounded-sm" style={{ background: RULE, opacity: 0.35 }} />
        </div>
        <div className="h-3 w-32 rounded-sm" style={{ background: RULE, opacity: 0.4 }} />
      </div>
      {/* Sağ panel skeleton — açık arka plan */}
      <div className="flex-1" style={{ background: CREAM }} />
    </div>
  )
}
