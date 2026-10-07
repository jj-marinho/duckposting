import { imageExtensions } from './images.js';

// Some dropped files have no MIME type. The upload path validates size and extension.
export function transferImages(event, upload, target) {
  const transfer = event.clipboardData || event.dataTransfer;
  const files = [...(transfer?.files || [])].filter(file => file.type.startsWith('image/') || !file.type && imageExtensions.test(file.name));
  if (!files.length) return false;
  event.preventDefault();
  void upload(files, target());
  return true;
}
