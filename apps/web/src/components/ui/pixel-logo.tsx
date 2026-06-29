// The Quad mark: a 2x2 pixel grid with the two diagonal cells in the tenant accent.
// Purely decorative — the wordmark beside it carries the name. Passing an explicit
// accent lets generated images reuse the exact mark without relying on page CSS.
export function PixelLogo({ size = 8, accent }: { readonly size?: number; readonly accent?: string }): React.ReactElement {
  return (
    <div
      className="quad-logo"
      aria-hidden
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        width: size * 2 + 2,
        height: size * 2 + 2,
      }}
    >
      {[accent, '#ffffff', '#ffffff', accent].map((background, index) => (
        <i
          key={index}
          style={{
            display: 'block',
            width: size,
            height: size,
            ...(accent ? { boxShadow: 'inset 0 0 0 1px #141414', background } : {}),
          }}
        />
      ))}
    </div>
  );
}
