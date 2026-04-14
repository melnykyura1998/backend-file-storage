"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAllowedImageMimeType = isAllowedImageMimeType;
exports.createUploadErrorMessage = createUploadErrorMessage;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
function isAllowedImageMimeType(mimeType) {
    return ALLOWED_IMAGE_TYPES.includes(mimeType);
}
function createUploadErrorMessage(mimeType) {
    if (!mimeType) {
        return 'Image file is required.';
    }
    return `Unsupported file type: ${mimeType}. Allowed types are JPEG, PNG, and WebP.`;
}
//# sourceMappingURL=upload.js.map