/** Round profile picture, falling back to the user's initial. */
export function Avatar({
  url,
  name,
  size = 32,
}: {
  url?: string | null;
  name: string;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden
      style={{ ...style, fontSize: size * 0.45 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-500 font-semibold text-white"
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
