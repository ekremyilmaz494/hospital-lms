/**
 * Editorial selamlama — *İyi günler, **Ayşe**.* paterni.
 * Görsel imza: italik isim olive renkte + gold full-stop.
 */
import { FONT_DISPLAY, GOLD, INK, INK_SOFT, OLIVE } from '@/lib/editorial-palette';

interface EdGreetingProps {
  greeting: string;
  name: string;
  lead?: string;
}

export function EdGreeting({ greeting, name, lead }: EdGreetingProps) {
  return (
    <div>
      <h1
        className="text-[26px] sm:text-[36px] md:text-[44px] leading-[0.95] font-semibold tracking-[-0.025em]"
        style={{ fontFamily: FONT_DISPLAY, color: INK }}
      >
        {greeting}, <span style={{ fontStyle: 'italic', color: OLIVE }}>{name}</span>
        <span style={{ color: GOLD }}>.</span>
      </h1>
      {lead && (
        <p
          className="mt-2.5 max-w-[560px] text-[14px] leading-[1.55]"
          style={{ color: INK_SOFT }}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

export function getEditorialGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}
