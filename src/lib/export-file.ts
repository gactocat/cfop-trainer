import { isNativeApp } from '@/lib/native';

export async function exportJsonFile(fileName: string, json: string): Promise<boolean> {
  if (isNativeApp()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'), import('@capacitor/share'),
    ]);
    const { uri } = await Filesystem.writeFile({
      path: fileName, data: json, directory: Directory.Cache, encoding: Encoding.UTF8,
    });
    try { await Share.share({ files: [uri] }); }
    catch (error) {
      if (error instanceof Error && error.message === 'Share canceled') return false;
      throw error;
    }
    finally { await Filesystem.deleteFile({ path: fileName, directory: Directory.Cache }); }
    return true;
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
