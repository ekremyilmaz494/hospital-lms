'use client';

import { useState, useEffect, useCallback } from 'react';

export type ColorTheme = 'emerald' | 'ocean' | 'violet' | 'rose' | 'amber';

const COLOR_KEY = 'color-theme';

function applyColorTheme(theme: ColorTheme) {
  const html = document.documentElement;
  if (theme === 'emerald') {
    html.removeAttribute('data-color');
  } else {
    html.setAttribute('data-color', theme);
  }
}

export function useColorTheme() {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>('emerald');

  useEffect(() => {
    const saved = (localStorage.getItem(COLOR_KEY) as ColorTheme) || 'emerald';
    setColorThemeState(saved);
    applyColorTheme(saved);
  }, []);

  const setColorTheme = useCallback((theme: ColorTheme) => {
    setColorThemeState(theme);
    applyColorTheme(theme);
    if (theme === 'emerald') {
      localStorage.removeItem(COLOR_KEY);
    } else {
      localStorage.setItem(COLOR_KEY, theme);
    }
  }, []);

  return { colorTheme, setColorTheme };
}

export const COLOR_THEMES: { id: ColorTheme; label: string; light: string; dark: string }[] = [
  { id: 'emerald', label: 'Zümrüt',  light: '#0d9668', dark: '#34d399' },
  { id: 'ocean',   label: 'Okyanus', light: '#0284c7', dark: '#38bdf8' },
  { id: 'violet',  label: 'Mor',     light: '#7c3aed', dark: '#a78bfa' },
  { id: 'rose',    label: 'Gül',     light: '#e11d48', dark: '#fb7185' },
  { id: 'amber',   label: 'Kehribar',light: '#b45309', dark: '#fbbf24' },
];
