/** Nejvyšší velikost souboru, kterou pošleme na server (limit požadavku na Vercelu je 4,5 MB). */
export const MAX_UPLOAD_BYTES = 4_300_000;

export const isHeicFile = (f: File) => /^image\/hei[cf](-sequence)?$/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
/** Obrázek podle typu, nebo podle přípony, když prohlížeč typ nezná (Windows u .heic posílá prázdný typ). */
export const isImageFile = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(f.name);

/**
 * Převod HEIC/HEIF (fotky z iPhonu) na JPEG v prohlížeči, který HEIC neumí zobrazit (Chrome, Firefox).
 * Knihovna (~1 MB) se stáhne až ve chvíli, kdy ji uživatel opravdu potřebuje.
 */
async function heicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import('heic2any');
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const blob = Array.isArray(out) ? out[0] : out;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

async function decode(file: File): Promise<{ bmp: ImageBitmap; file: File }> {
  try {
    return { bmp: await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions), file };
  } catch (e) {
    if (!isHeicFile(file)) throw e;
    const jpeg = await heicToJpeg(file);
    return { bmp: await createImageBitmap(jpeg, { imageOrientation: 'from-image' } as ImageBitmapOptions), file: jpeg };
  }
}

/**
 * Zmenší fotku v prohlížeči před nahráním (max. 2000 px, JPEG ~0,86).
 * Šetří data na mobilu a drží požadavek pod limitem serveru. Server pak vytvoří WebP a náhled.
 * HEIC převede na JPEG (i když ho prohlížeč sám neumí), průhledné pozadí PNG vyplní bílou.
 */
export async function shrinkImage(file: File, max = 2000, quality = 0.86): Promise<File> {
  if (!isImageFile(file) || file.type === 'image/gif') return file;
  const heic = isHeicFile(file);
  let decoded: { bmp: ImageBitmap; file: File };
  try {
    decoded = await decode(file);
  } catch {
    // Nepodařilo se přečíst – pošleme originál, server ho zkusí zpracovat sám a případně vysvětlí proč ne
    return file;
  }
  const { bmp } = decoded;
  try {
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    // Malou fotku v běžném formátu pošleme beze změny (HEIC vždy převádíme)
    if (!heic && scale === 1 && decoded.file.size < 3_000_000) return decoded.file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const q of [quality, 0.75, 0.6]) {
      blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
      if (!blob || blob.size <= MAX_UPLOAD_BYTES) break;
    }
    if (!blob) return decoded.file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally {
    bmp.close();
  }
}
