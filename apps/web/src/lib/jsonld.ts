import { abs, SITE, SITE_NAME } from './seo';

/** Strukturovaná data schema.org podle typu obsahu. */
type Json = Record<string, unknown>;

export function breadcrumbs(items: { name: string; path: string }[]): Json {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

export function itemList(items: { id: string; slug: string; title: string }[], startAt = 1): Json {
  return {
    '@context': 'https://schema.org', '@type': 'ItemList', numberOfItems: items.length,
    itemListElement: items.map((l, i) => ({ '@type': 'ListItem', position: startAt + i, url: abs(`/inzerat/${l.id}/${l.slug}`), name: l.title })),
  };
}

export function website(): Json {
  return {
    '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: SITE, inLanguage: 'cs-CZ',
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/hledat?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
  };
}

export function organization(o: { name: string; email?: string; phone?: string; address?: string; ico?: string }): Json {
  const real = (v?: string) => (v && !v.startsWith('[') ? v : undefined);
  return {
    '@context': 'https://schema.org', '@type': 'Organization', name: real(o.name) ?? SITE_NAME, url: SITE, logo: abs('/icon.svg'),
    ...(real(o.email) ? { email: real(o.email) } : {}), ...(real(o.phone) ? { telephone: real(o.phone) } : {}),
    ...(real(o.address) ? { address: real(o.address) } : {}), ...(real(o.ico) ? { taxID: real(o.ico) } : {}),
    contactPoint: real(o.email) ? [{ '@type': 'ContactPoint', contactType: 'customer support', email: real(o.email), availableLanguage: ['cs', 'sk'] }] : undefined,
  };
}

export interface ListingLd {
  id: string; slug: string; title: string; description: string; price: number | null; currency: string; condition: string | null; offerType: string; status: string;
  city: string; region: string; zip: string | null; attributes: Record<string, unknown>; publishedAt: string | null; createdAt: string; expiresAt: string;
  images: { url: string }[]; category: { slug: string; name: string; parent: { slug: string; name: string } | null };
  seller: { id: string; name: string; isBusiness: boolean; companyName: string | null; rating: number | null; reviewCount: number };
}

const CONDITION: Record<string, string> = { NEW: 'https://schema.org/NewCondition', LIKE_NEW: 'https://schema.org/UsedCondition', USED: 'https://schema.org/UsedCondition', DAMAGED: 'https://schema.org/DamagedCondition' };
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

const EMPLOYMENT: Record<string, string> = { 'Plný úvazek': 'FULL_TIME', 'Částečný úvazek': 'PART_TIME', Brigáda: 'TEMPORARY', 'DPP/DPČ': 'PART_TIME', IČO: 'CONTRACTOR' };
const employment = (v: unknown) => [...new Set((Array.isArray(v) ? v : [v]).map((x) => EMPLOYMENT[String(x)]).filter(Boolean))];

/** Typ strukturovaných dat podle hlavní kategorie inzerátu. */
export function listingKind(parentSlug: string, subSlug: string): 'job' | 'realestate' | 'vehicle' | 'service' | 'product' {
  if (parentSlug === 'prace' || parentSlug.startsWith('prace-')) return subSlug === 'hledam-praci' ? 'service' : 'job';
  if (parentSlug === 'reality') return 'realestate';
  if (parentSlug === 'sluzby' || parentSlug.startsWith('sluzby-')) return 'service';
  if (parentSlug === 'auto-moto' && !/(dil|pneu|kola|prislus)/.test(subSlug)) return 'vehicle';
  return 'product';
}

export function listingJsonLd(l: ListingLd): Json[] {
  const parent = l.category.parent ?? l.category;
  const url = abs(`/inzerat/${l.id}/${l.slug}`);
  const description = l.description.slice(0, 500);
  const images = l.images.map((i) => abs(i.url));
  const a = l.attributes ?? {};
  const sellerName = l.seller.companyName ?? l.seller.name;
  const seller = { '@type': l.seller.isBusiness ? 'Organization' : 'Person', name: sellerName, url: abs(`/uzivatel/${l.seller.id}`) };
  const place = { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: l.city, ...(l.zip ? { postalCode: l.zip } : {}), addressCountry: 'CZ' } };
  const available = ['ACTIVE', 'RESERVED'].includes(l.status);
  const offer = l.price != null ? {
    '@type': 'Offer', price: l.price, priceCurrency: l.currency, url, seller, areaServed: l.city,
    availability: l.status === 'SOLD' ? 'https://schema.org/SoldOut' : available ? 'https://schema.org/InStock' : 'https://schema.org/Discontinued',
    ...(l.condition ? { itemCondition: CONDITION[l.condition] } : {}),
    ...(l.offerType === 'RENT' ? { businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut' } : {}),
  } : undefined;
  const kind = listingKind(parent.slug, l.category.slug);
  let main: Json;

  if (kind === 'job') {
    main = {
      '@type': 'JobPosting', title: l.title, description, datePosted: l.publishedAt ?? l.createdAt, validThrough: l.expiresAt, url,
      hiringOrganization: { '@type': l.seller.isBusiness ? 'Organization' : 'Person', name: sellerName, sameAs: abs(`/uzivatel/${l.seller.id}`) },
      jobLocation: place, directApply: true,
      ...(employment(a.jobType).length ? { employmentType: employment(a.jobType) } : {}),
      ...((num(a.salary) ?? l.price) != null ? { baseSalary: { '@type': 'MonetaryAmount', currency: l.currency, value: { '@type': 'QuantitativeValue', value: num(a.salary) ?? l.price, unitText: 'MONTH' } } } : {}),
    };
  } else if (kind === 'realestate') {
    const area = num(a.area);
    main = {
      '@type': 'RealEstateListing', name: l.title, description, url, image: images, datePosted: l.publishedAt ?? l.createdAt,
      ...(offer ? { offers: { ...offer, itemOffered: { '@type': 'Accommodation', name: l.title, ...(area ? { floorSize: { '@type': 'QuantitativeValue', value: area, unitCode: 'MTK' } } : {}), ...(parseInt(String(a.layout ?? ''), 10) > 0 ? { numberOfRooms: parseInt(String(a.layout), 10) } : {}), address: place.address } } } : {}),
    };
  } else if (kind === 'service') {
    main = { '@type': 'Service', name: l.title, description, url, image: images, provider: seller, areaServed: { '@type': 'City', name: l.city }, category: l.category.name, ...(offer ? { offers: offer } : {}) };
  } else if (kind === 'vehicle') {
    const km = num(a.mileage), year = num(a.year), power = num(a.power);
    main = {
      '@type': l.category.slug === 'osobni-auta' ? 'Car' : l.category.slug === 'motorky' ? 'Motorcycle' : 'Vehicle', name: l.title, description, url, image: images, category: `${parent.name} > ${l.category.name}`,
      ...(str(a.brand) ? { brand: { '@type': 'Brand', name: str(a.brand) } } : {}), ...(str(a.model) ? { model: str(a.model) } : {}),
      ...(km != null ? { mileageFromOdometer: { '@type': 'QuantitativeValue', value: km, unitCode: 'KMT' } } : {}),
      ...(year ? { vehicleModelDate: String(year), productionDate: String(year) } : {}),
      ...(str(a.fuel) ? { fuelType: str(a.fuel) } : {}), ...(str(a.gearbox) ? { vehicleTransmission: str(a.gearbox) } : {}), ...(str(a.body) ? { bodyType: str(a.body) } : {}),
      ...(power ? { vehicleEngine: { '@type': 'EngineSpecification', enginePower: { '@type': 'QuantitativeValue', value: power, unitCode: 'KWT' } } } : {}),
      ...(offer ? { offers: offer } : {}),
    };
  } else {
    main = {
      '@type': 'Product', name: l.title, description, url, image: images, category: `${parent.name} > ${l.category.name}`,
      ...(str(a.brand) ? { brand: { '@type': 'Brand', name: str(a.brand) } } : {}),
      ...(offer ? { offers: offer } : {}),
    };
  }
  return [
    { '@context': 'https://schema.org', ...main },
    breadcrumbs([{ name: 'Domů', path: '/' }, { name: parent.name, path: `/kategorie/${parent.slug}` }, ...(l.category.parent ? [{ name: l.category.name, path: `/kategorie/${parent.slug}/${l.category.slug}` }] : []), { name: l.title, path: `/inzerat/${l.id}/${l.slug}` }]),
  ];
}

export function profileJsonLd(p: { id: string; name: string; companyName: string | null; isBusiness: boolean; avatarUrl: string | null; city: string | null; bio: string | null; rating: number | null; reviewCount: number }): Json {
  return {
    '@context': 'https://schema.org', '@type': p.isBusiness ? 'Organization' : 'Person', name: p.companyName ?? p.name, url: abs(`/uzivatel/${p.id}`),
    ...(p.avatarUrl ? { image: abs(p.avatarUrl) } : {}), ...(p.bio ? { description: p.bio.slice(0, 300) } : {}),
    ...(p.city ? { address: { '@type': 'PostalAddress', addressLocality: p.city, addressCountry: 'CZ' } } : {}),
    ...(p.reviewCount > 0 && p.rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Math.round(p.rating * 10) / 10, reviewCount: p.reviewCount, bestRating: 5, worstRating: 1 } } : {}),
  };
}

/** Bezpečné vložení JSON-LD do HTML (escapování „<“). */
export const ldHtml = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
