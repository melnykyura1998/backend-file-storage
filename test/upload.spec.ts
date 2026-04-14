import { strict as assert } from 'node:assert';
import { describe, it } from 'mocha';
import {
  createUploadErrorMessage,
  isAllowedImageMimeType,
} from '../src/common/upload';

describe('upload helpers', () => {
  it('accepts supported image mime types', () => {
    assert.equal(isAllowedImageMimeType('image/png'), true);
    assert.equal(isAllowedImageMimeType('image/jpeg'), true);
    assert.equal(isAllowedImageMimeType('image/webp'), true);
  });

  it('returns a clear validation message for unsupported uploads', () => {
    assert.equal(
      createUploadErrorMessage('application/pdf'),
      'Unsupported file type: application/pdf. Allowed types are JPEG, PNG, and WebP.',
    );
  });
});
