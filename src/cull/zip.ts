// A plain "stored" (uncompressed) .zip built as a Blob made of the original
// files themselves plus small headers, so hundreds of large JPGs never have
// to sit in memory at once. Only the CRC of each file has to be read.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array, crc = 0) {
  let c = ~crc >>> 0
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}

async function crcOfBlob(blob: Blob) {
  let crc = 0
  const CHUNK = 8 * 1024 * 1024
  for (let at = 0; at < blob.size; at += CHUNK) crc = crc32(new Uint8Array(await blob.slice(at, at + CHUNK).arrayBuffer()), crc)
  return crc
}

/** The most a zip without ZIP64 can hold. */
export const ZIP_MAX = 0xffffffff - 64 * 1024 * 1024

const dosTime = (d: Date) => ({
  time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
  date: (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
})

export async function storedZip(folder: string, files: File[], onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const enc = new TextEncoder()
  const parts: BlobPart[] = []
  const central: BlobPart[] = []
  let offset = 0
  const used = new Set<string>()

  const entry = (name: string, crc: number, size: number, when: Date, dir: boolean) => {
    const n = enc.encode(name)
    const { time, date } = dosTime(when)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, dir ? 10 : 20, true)
    local.setUint16(6, 0x0800, true) // UTF-8 names
    local.setUint16(8, 0, true) // stored
    local.setUint16(10, time, true)
    local.setUint16(12, date, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, size, true)
    local.setUint32(22, size, true)
    local.setUint16(26, n.length, true)
    local.setUint16(28, 0, true)
    const cd = new DataView(new ArrayBuffer(46 + n.length))
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(4, 0x0314, true) // made by: Unix, 2.0
    cd.setUint16(6, dir ? 10 : 20, true)
    cd.setUint16(8, 0x0800, true)
    cd.setUint16(10, 0, true)
    cd.setUint16(12, time, true)
    cd.setUint16(14, date, true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, size, true)
    cd.setUint32(24, size, true)
    cd.setUint16(28, n.length, true)
    cd.setUint32(38, dir ? (0o40755 << 16) | 0x10 : 0o100644 << 16, true)
    cd.setUint32(42, offset, true)
    new Uint8Array(cd.buffer).set(n, 46)
    central.push(new Uint8Array(cd.buffer))
    parts.push(new Uint8Array(local.buffer), n as Uint8Array<ArrayBuffer>)
    offset += 30 + n.length + size
  }

  entry(`${folder}/`, 0, 0, new Date(), true)
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length)
    const f = files[i]
    let name = f.name
    if (used.has(name.toLowerCase())) name = name.replace(/(\.[^.]+)?$/, (ext) => `-${i + 1}${ext}`)
    used.add(name.toLowerCase())
    entry(`${folder}/${name}`, await crcOfBlob(f), f.size, new Date(f.lastModified || Date.now()), false)
    parts.push(f)
  }
  const cdSize = (central as Uint8Array[]).reduce((n, c) => n + c.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, central.length, true)
  end.setUint16(10, central.length, true)
  end.setUint32(12, cdSize, true)
  end.setUint32(16, offset, true)
  onProgress?.(files.length, files.length)
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' })
}
