const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function isAllowedImageMimeType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType);
}

export function createUploadErrorMessage(mimeType?: string): string {
  if (!mimeType) {
    return 'Image file is required.';
  }

  return `Unsupported file type: ${mimeType}. Allowed types are JPEG, PNG, and WebP.`;
}
