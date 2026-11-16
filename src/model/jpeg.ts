// Reading what a JPEG says about itself, without decoding it: its stored
// pixel size, its EXIF orientation (how the camera says to turn it) and its
// embedded colour profile.

export interface JpegInfo {
  /** Pixels as stored in the file. */
  width: number
  height: number
  components: number
  /** EXIF orientation, 1–8 (1 = upright). */
  orientation: number
  /** The embedded ICC colour profile, if any. */
  icc: Uint8Array | null
  progressive: boolean
}

/** Orientations 5–8 turn the picture a quarter turn: width and height swap. */
export const swapsAxes = (o: number) => o >= 5 && o <= 8

/** Size as the picture should be shown, after its orientation. */
export const displaySize = (info: Pick<JpegInfo, 'width' | 'height' | 'orientation'>) =>
  swapsAxes(info.orientation) ? { w: info.height, h: info.width } : { w: info.width, h: info.height }

export function parseJpeg(b: Uint8Array): JpegInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null
  let orientation = 1
  let width = 0
  let height = 0
  let components = 0
  let progressive = false
  const iccChunks: { seq: number; data: Uint8Array }[] = []

  let i = 2
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) {
      i++
      continue
    }
    const marker = b[i + 1]
    if (marker === 0xff) {
      i++
      continue
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) break // end, or start of image data
    const len = (b[i + 2] << 8) | b[i + 3]
    const start = i + 4
    const end = i + 2 + len
    if (len < 2 || end > b.length) break

    if (marker === 0xe1 && ascii(b, start, 6) === 'Exif\0\0') orientation = readOrientation(b, start + 6, end) ?? orientation
    else if (marker === 0xe2 && ascii(b, start, 12) === 'ICC_PROFILE\0') iccChunks.push({ seq: b[start + 12], data: b.subarray(start + 14, end) })
    else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      height = (b[start + 1] << 8) | b[start + 2]
      width = (b[start + 3] << 8) | b[start + 4]
      components = b[start + 5]
      progressive = marker === 0xc2 || marker === 0xc6 || marker === 0xca || marker === 0xce
    }
    i = end
  }
  if (!width || !height) return null

  let icc: Uint8Array | null = null
  if (iccChunks.length) {
    iccChunks.sort((a, z) => a.seq - z.seq)
    const total = iccChunks.reduce((n, c) => n + c.data.length, 0)
    icc = new Uint8Array(total)
    let o = 0
    for (const c of iccChunks) {
      icc.set(c.data, o)
      o += c.data.length
    }
  }
  return { width, height, components, orientation: orientation >= 1 && orientation <= 8 ? orientation : 1, icc, progressive }
}

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n))

/** Find tag 0x0112 (Orientation) in the first IFD of a TIFF block. */
function readOrientation(b: Uint8Array, tiff: number, end: number): number | null {
  if (tiff + 8 > end) return null
  const le = b[tiff] === 0x49 && b[tiff + 1] === 0x49
  const u16 = (p: number) => (le ? b[p] | (b[p + 1] << 8) : (b[p] << 8) | b[p + 1])
  const u32 = (p: number) => (le ? (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0 : ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0)
  if (u16(tiff + 2) !== 42) return null
  const ifd = tiff + u32(tiff + 4)
  if (ifd + 2 > end) return null
  const n = u16(ifd)
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12
    if (e + 12 > end) return null
    if (u16(e) === 0x0112) return u16(e + 8)
  }
  return null
}

/** The JPEG's header is near the start: read just enough of the file. */
export async function readJpegInfo(file: Blob): Promise<JpegInfo | null> {
  for (const size of [256 * 1024, 2 * 1024 * 1024, file.size]) {
    const head = new Uint8Array(await file.slice(0, size).arrayBuffer())
    const info = parseJpeg(head)
    if (info || size >= file.size) return info
  }
  return null
}

/**
 * Where a picture's stored pixels land once it's turned the way the camera
 * says, as a map of the unit square (y up, as in PDF): s = a·u + c·v + e,
 * t = b·u + d·v + f.
 */
export function orientationMatrix(o: number): [number, number, number, number, number, number] {
  switch (o) {
    case 2:
      return [-1, 0, 0, 1, 1, 0]
    case 3:
      return [-1, 0, 0, -1, 1, 1]
    case 4:
      return [1, 0, 0, -1, 0, 1]
    case 5:
      return [0, -1, -1, 0, 1, 1]
    case 6:
      return [0, -1, 1, 0, 0, 1]
    case 7:
      return [0, 1, 1, 0, 0, 0]
    case 8:
      return [0, 1, -1, 0, 1, 0]
    default:
      return [1, 0, 0, 1, 0, 0]
  }
}
