export async function copyImage(source: () => Promise<string>) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined')
    throw new Error('Image copying is not supported in this browser.');
  // Pass the promise immediately to preserve clipboard permission in Safari.
  const png = (async () => {
    const response = await fetch(await source(), { credentials: 'omit' });
    if (!response.ok) throw new Error('Could not load the image for copying.');
    const blob = await response.blob();
    if (blob.type === 'image/png') return blob;
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare the image for copying.');
      context.drawImage(bitmap, 0, 0);
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error('Could not convert the image.'))),
          'image/png',
        ),
      );
    } finally {
      bitmap.close();
    }
  })();
  // Handle conversion failures even when clipboard access is rejected first.
  void png.catch(() => {});
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}
