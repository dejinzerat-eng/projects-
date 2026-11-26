import { ImageResponse } from 'next/og';

/** Výchozí obrázek pro sdílení (Open Graph / Twitter), 1200 × 630. */
export const alt = 'Dejinzerat.cz – moderní inzerce a bazar zdarma';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: 'linear-gradient(135deg, #ffffff 0%, #e3f5ee 100%)', color: '#1b1f24', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <svg width="96" height="96" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="9" fill="#0e9f6e" />
            <path d="M9.5 10.5c0-1.1.9-2 2-2h9a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-5.2l-3.6 3.1c-.5.4-1.2.1-1.2-.6v-2.5a2 2 0 0 1-1-1.7z" fill="#fff" />
            <circle cx="19.2" cy="12.3" r="1.5" fill="#0e9f6e" />
          </svg>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>
            <span style={{ color: '#0e9f6e' }}>dej</span><span>inzerat</span><span style={{ color: '#69717a' }}>.cz</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Prodejte to, co už nepotřebujete.</div>
          <div style={{ fontSize: 36, color: '#353b42' }}>Inzeráty zdarma z celé České republiky</div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 28, color: '#087050' }}>
          <span>Auto-moto</span><span>·</span><span>Reality</span><span>·</span><span>Elektronika</span><span>·</span><span>Práce</span><span>·</span><span>Služby</span>
        </div>
      </div>
    ),
    size,
  );
}
