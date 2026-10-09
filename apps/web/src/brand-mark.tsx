/** The brand monogram drawn beside the brand name, so it stays decorative: the name next to it is the accessible label. */
export function BrandMark({ size }: Readonly<{ size: number }>) {
  return <img alt="" className="brand-mark" height={size} src="/favicon.svg" width={size} />
}
