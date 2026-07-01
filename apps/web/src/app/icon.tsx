import { ImageResponse } from 'next/og';
import { resolveCurrentTenant, FALLBACK_PRIMARY } from '@/lib/tenant';
import { PixelLogo } from '@/components/ui/pixel-logo';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/** The same tenant-aware Quad mark rendered in the app bar. */
export default async function Icon(): Promise<ImageResponse> {
  const tenant = await resolveCurrentTenant();
  const accent = tenant?.themePrimary ?? FALLBACK_PRIMARY;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
      }}
    >
      <PixelLogo size={12} accent={accent} />
    </div>,
    size,
  );
}
