// GENERATED from src/shared/design-core by scripts/design/sync-design-core.mjs - do not edit here.
/**
 * Design document types - the JSON stored in design-template.layoutConfig
 * and snapshotted onto each issued credential. Version 1.
 *
 * Coordinates are CSS pixels at 96 DPI with the origin at the page's top
 * left. Element order in `elements` is paint order (last = on top), which
 * is also the Layers panel order (reversed for display).
 */

export type DesignKind = 'certificate' | 'badge'
export type Orientation = 'landscape' | 'portrait'
export type PagePreset = 'A4' | 'Letter' | 'badge-square' | 'custom'

/**
 * A colour: `#rrggbb`, `#rrggbbaa`, `transparent`, or a brand token such as
 * `$brand.primary` that is resolved from the organization's brand kit.
 */
export type Color = string

export interface Page {
  preset: PagePreset
  orientation: Orientation
  width: number
  height: number
}

export interface Background {
  color: Color
  image?: { src: string, fit: ImageFit, opacity?: number } | null
}

export type ImageFit = 'contain' | 'cover' | 'fill'
export type TextAlign = 'left' | 'center' | 'right'
export type VerticalAlign = 'top' | 'middle' | 'bottom'

/**
 * Brand bindings: an element with `bind` is filled from the organization's
 * brand kit when a template is applied (logo/signature images, signer name
 * and title text). After applying, the element is ordinary editable content.
 */
export type BrandBinding
  = | 'brand.logo'
    | 'brand.signature.1' | 'brand.signature.2' | 'brand.signature.3'
    | 'brand.signer.1.name' | 'brand.signer.2.name' | 'brand.signer.3.name'
    | 'brand.signer.1.title' | 'brand.signer.2.title' | 'brand.signer.3.title'

interface ElementBase {
  id: string
  name?: string
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  opacity?: number
  locked?: boolean
  hidden?: boolean
  bind?: BrandBinding
}

export interface TextElement extends ElementBase {
  type: 'text'
  /** May contain placeholders: `Awarded to {{recipient.name}}`. */
  content: string
  fontFamily: string
  fontWeight: number
  italic?: boolean
  fontSize: number
  color: Color
  align: TextAlign
  vAlign?: VerticalAlign
  /** Multiple of the font size. */
  lineHeight?: number
  /** Extra space between characters, px. */
  letterSpacing?: number
  uppercase?: boolean
  /** Shrink the font (down to minFontSize) until the text fits the box. */
  autoFit?: boolean
  minFontSize?: number
  /**
   * Curved text (badges): radius in px of the arc the baseline follows.
   * Positive curves like a smile's top (text on top of a circle), negative
   * the other way. 0/undefined = straight.
   */
  curve?: number
}

export interface ImageElement extends ElementBase {
  type: 'image'
  src: string
  assetId?: string | number
  fit: ImageFit
  clip?: 'none' | 'circle' | 'rounded'
}

export type ShapeKind
  = | 'rect' | 'ellipse' | 'triangle' | 'star' | 'hexagon' | 'shield'
    | 'sunburst' | 'ribbon' | 'banner' | 'diamond'

export interface ShapeElement extends ElementBase {
  type: 'shape'
  shape: ShapeKind
  fill: Color
  stroke?: Color
  strokeWidth?: number
  /** rect: corner radius. star/sunburst: number of points. */
  radius?: number
  points?: number
  /** Second colour for two-tone shapes (ribbon fold, sunburst rim). */
  fill2?: Color
}

export interface LineElement extends ElementBase {
  type: 'line'
  stroke: Color
  strokeWidth: number
  dash?: 'solid' | 'dashed' | 'dotted'
}

export interface QrElement extends ElementBase {
  type: 'qr'
  /** What the code encodes. Only the verification URL for now. */
  target: 'verifyUrl'
  fg: Color
  bg: Color
}

export type FrameStyle = 'classic' | 'double' | 'guilloche' | 'corners' | 'deco' | 'wave' | 'dots'

/** Parametric, recolourable border drawn inside its box. */
export interface FrameElement extends ElementBase {
  type: 'frame'
  style: FrameStyle
  color: Color
  color2?: Color
  thickness: number
}

export type DesignElement = TextElement | ImageElement | ShapeElement | LineElement | QrElement | FrameElement
export type ElementType = DesignElement['type']

export interface Design {
  version: 1
  kind: DesignKind
  page: Page
  background: Background
  elements: DesignElement[]
}

export interface BrandKit {
  logo?: string | null
  primary?: string | null
  secondary?: string | null
  accent?: string | null
  headingFont?: string | null
  bodyFont?: string | null
  signers?: Array<{ name?: string | null, title?: string | null, signature?: string | null }>
}

/** Values for `{{placeholder}}` substitution, keyed `recipient.name` etc. */
export type PlaceholderData = Record<string, string | null | undefined>
