import { ImageResponse } from 'next/og';
import { LOGO_COLORS, LOGO_PATH_A, LOGO_PATH_B, LOGO_RATIO, LOGO_VIEWBOX } from '@/components/logo-paths';

/** Výchozí obrázek pro sdílení (Open Graph / Twitter), 1200 × 630. */
export const alt = 'DEJINZERAT.cz – moderní inzerce a bazar zdarma';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: 'linear-gradient(135deg, #ffffff 0%, #e3f5ee 100%)', color: '#1b1f24', fontFamily: 'sans-serif' }}>
        <svg width={440} height={440 / LOGO_RATIO} viewBox={LOGO_VIEWBOX}>
          <path fill={LOGO_COLORS.a} d={LOGO_PATH_A} />
          <path fill={LOGO_COLORS.b} d={LOGO_PATH_B} />
        </svg>
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
