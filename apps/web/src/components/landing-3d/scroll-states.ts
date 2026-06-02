export type ScrollState = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};

export const SCROLL_STATES: ScrollState[] = [
  // 0 — Hero: sağ tarafta, 3/4 açı, hafif yukarı bakış.
  { id: "hero",     position: [ 0.75,  0.05,  0.0],  rotation: [ 0.10,  Math.PI - 0.70,  0.05], scale: 1.9 },
  // 1 — Closeup: sola ve öne, büyük — ventrikül detayı görünür.
  { id: "closeup",  position: [-0.70,  0.00,  0.7],  rotation: [ 0.05,  Math.PI - 0.20,  0.02], scale: 2.1 },
  // 2 — Front: ortada, tam karşıdan.
  { id: "front",    position: [-0.25, -0.05,  0.2],  rotation: [ 0.02,  Math.PI,         0.0 ], scale: 1.8 },
  // 3 — Top: üstten, yatay duruş — atriyum detayı.
  { id: "top",      position: [ 0.00,  0.05,  0.4],  rotation: [ Math.PI / 2 - 0.15, 0.0, Math.PI / 2], scale: 1.75 },
  // 4 — Back: çapraz arkadan, sağda.
  { id: "back",     position: [ 0.60, -0.05,  0.0],  rotation: [-0.10, -1.40,            0.15], scale: 1.6 },
  // 5 — Final: solda, karşıya dönük, hafif büyütülmüş.
  { id: "final",    position: [-0.90, -0.05,  0.2],  rotation: [ 0.05,  Math.PI - 0.40, -0.02], scale: 1.9 },
];

// Mobil/tablet çarpanları (≤1023px). Hareketi merkeze sıkıştırır,
// modeli küçük canvas bandını dolduracak şekilde büyütür.
export const MOBILE_SCALE_FACTOR = 1.1;
export const MOBILE_POSITION_FACTOR = 0.1;
