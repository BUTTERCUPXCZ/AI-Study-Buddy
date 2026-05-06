/**
 * Map backend upload-validation messages to short, friendly,
 * user-facing strings. The backend's exact phrasing is technically
 * accurate but unhelpful at the UI layer ("File content is not a
 * valid PDF" sounds scary; "This file isn't a real PDF…" is actionable).
 *
 * Returns `{ title, hint }` so the UI can render a two-line toast or
 * dialog. Unknown messages fall back to the raw text under a generic
 * "Upload failed" title.
 */
export interface FriendlyUploadError {
  title: string
  hint: string
}

export function friendlyUploadError(rawMessage: string): FriendlyUploadError {
  const msg = (rawMessage ?? '').toLowerCase()

  if (msg.includes('file content is not a valid pdf')) {
    return {
      title: "That file isn't a real PDF",
      hint: 'Make sure you are uploading the original PDF, not a renamed image, Word doc, or screenshot. Try opening the file in a PDF reader to confirm it works.',
    }
  }

  if (msg.includes('file size exceeds')) {
    return {
      title: 'PDF too large (max 10 MB)',
      hint: 'Try compressing the PDF, or upload a smaller section / chapter at a time.',
    }
  }

  if (msg.includes('only pdf files are allowed')) {
    return {
      title: 'Only PDF files are accepted',
      hint: 'Save your document as a PDF first, then upload it again.',
    }
  }

  if (msg.includes('invalid filename')) {
    return {
      title: 'Filename has invalid characters',
      hint: 'Rename the file to something simple (letters, numbers, dashes only) — for example "lecture-1.pdf".',
    }
  }

  if (msg.includes('no file provided') || msg.includes('no file uploaded')) {
    return {
      title: 'No file selected',
      hint: 'Pick a PDF from your computer and try again.',
    }
  }

  if (msg.includes('system is busy') || msg.includes('try again in a minute')) {
    return {
      title: 'Server is busy right now',
      hint: 'Please wait about a minute and try uploading again.',
    }
  }

  if (msg.includes('too many') || msg.includes('rate limit') || msg.includes('429')) {
    return {
      title: 'Too many uploads in a short time',
      hint: 'Slow down for a moment, then try again.',
    }
  }

  if (
    msg.includes('email not verified') ||
    msg.includes('please verify your email')
  ) {
    return {
      title: 'Verify your email first',
      hint: 'Check your inbox for the confirmation link before uploading PDFs.',
    }
  }

  if (msg.includes('streaming not supported')) {
    return {
      title: 'Browser does not support streaming uploads',
      hint: 'Please update Chrome/Firefox/Edge to the latest version, or try a different browser.',
    }
  }

  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return {
      title: 'Network problem',
      hint: 'Check your internet connection and try uploading again.',
    }
  }

  if (msg.includes('generation failed')) {
    return {
      title: 'AI could not finish your notes',
      hint: 'Sometimes the AI service is overloaded — please try uploading again in a moment.',
    }
  }

  return {
    title: 'Upload failed',
    hint: rawMessage || 'Something went wrong. Please try again.',
  }
}
