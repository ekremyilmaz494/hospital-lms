import { describe, it, expect } from 'vitest';
import {
  breadcrumbJsonLd,
  FOUNDING_DATE,
  homeJsonLd,
  JSONLD_IDS,
  organizationJsonLd,
} from '../organization-jsonld';

type Node = Record<string, unknown> & { '@type': string };

const graph = (json: string): Node[] => JSON.parse(json)['@graph'];
const byType = (nodes: Node[], type: string) => nodes.find((n) => n['@type'] === type);
const as = <T,>(node: Node | undefined) => node as unknown as T;

describe('organizationJsonLd', () => {
  it('Organization + WebSite grafiğini kurumsal künyeyle üretir', () => {
    const nodes = graph(organizationJsonLd('en'));
    const org = as<Record<string, unknown> & { founder: { name: string } }>(byType(nodes, 'Organization'));
    expect(org['@id']).toBe(JSONLD_IDS.organization);
    expect(org.url).toBe('https://klinovax.com');
    expect(org.foundingDate).toBe(FOUNDING_DATE);
    expect(org.founder.name).toBe('Ekrem Yılmaz');
    expect(org.email).toMatch(/@klinovax\.com$/);
    expect(byType(nodes, 'WebSite')?.publisher).toEqual({ '@id': JSONLD_IDS.organization });
    expect(byType(nodes, 'SoftwareApplication')).toBeUndefined();
  });

  it('açık adres, TC/VKN ve uydurma fiyat/puan içermez', () => {
    const json = homeJsonLd('tr');
    const org = as<{ address: Record<string, string> }>(byType(graph(json), 'Organization'));
    expect(Object.keys(org.address).sort()).toEqual(['@type', 'addressCountry', 'addressLocality']);
    expect(json).not.toMatch(/streetAddress|taxID|vatID|aggregateRating|"offers"/);
    // TC (11) / VKN (10) gibi tek başına rakam dizisi yok; mağaza URL'sindeki "id123…" sayılmaz
    expect(json).not.toMatch(/(?<![\w/])\d{10,}/);
  });

  it('script kırılmasına karşı < karakterini kaçışlar', () => {
    expect(organizationJsonLd()).not.toContain('<');
    expect(homeJsonLd()).not.toContain('<');
  });
});

describe('homeJsonLd', () => {
  it('ana sayfaya SoftwareApplication ekler ve organizasyona bağlar', () => {
    const app = byType(graph(homeJsonLd('tr')), 'SoftwareApplication');
    expect(app?.publisher).toEqual({ '@id': JSONLD_IDS.organization });
    expect(app?.operatingSystem).toBe('Web, iOS, Android');
    expect(byType(graph(homeJsonLd('en')), 'SoftwareApplication')?.url).toBe('https://klinovax.com/en');
  });
});

describe('breadcrumbJsonLd', () => {
  it('ana sayfayla başlayan mutlak URL zinciri üretir', () => {
    const [list] = graph(breadcrumbJsonLd([{ name: 'Güvenlik', path: '/guvenlik' }])) as Array<
      Node & { itemListElement: Array<{ position: number; item: string }> }
    >;
    expect(list['@type']).toBe('BreadcrumbList');
    expect(list.itemListElement.map((i) => [i.position, i.item])).toEqual([
      [1, 'https://klinovax.com/'],
      [2, 'https://klinovax.com/guvenlik'],
    ]);
  });
});
