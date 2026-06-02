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
  // 3 — Exam: öne dönük (ekran kullanıcıya bakar), karşı taraftan 3/4 açı —
  //     sınav ekranı okunur. Kopya solda, art sağ-altta → telefon merkez-sağ.
  { id: "top",      position: [ 0.18,  0.06,  0.45], rotation: [ 0.07,  Math.PI + 0.34, -0.05], scale: 1.85 },
  // 4 — Cert: öne dönük, merkez (yan-alan sanatı sağ-alta sığsın), takdim eğimi — sertifika ekranı görünür.
  { id: "back",     position: [-0.25, -0.10,  0.10], rotation: [ 0.12,  Math.PI - 0.55,  0.07], scale: 1.65 },
  // 5 — Güven (kapanış): sağda, dikeyde merkez (aşağı batmaz), öne dönük — Devakent
  //     referansı. Kopya solda; telefon sağa kayıp burada sabitlenir, alt bölüme sarkmaz.
  { id: "guven",    position: [ 0.58, -0.05,  0.10], rotation: [ 0.12,  Math.PI - 0.55,  0.07], scale: 1.6 },
];

// Mobil/tablet çarpanları (≤1023px). Hareketi merkeze sıkıştırır,
// modeli küçük canvas bandını dolduracak şekilde büyütür.
export const MOBILE_SCALE_FACTOR = 1.1;
export const MOBILE_POSITION_FACTOR = 0.1;
