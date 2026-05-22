/** Должно совпадать с UPLOAD_MAX_BYTES на сервере (.env). */
export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024

export const UPLOAD_MAX_SIZE_LABEL = '25 МБ'

export function validateUploadFile(file: File): string | null {
  if (file.size <= 0)
    return `Файл «${file.name}» пустой.`
  if (file.size > UPLOAD_MAX_BYTES) {
    return `Файл «${file.name}» слишком большой. Максимальный размер — ${UPLOAD_MAX_SIZE_LABEL}.`
  }
  return null
}

export function assertUploadFilesValid(files: File[]): void {
  for (const file of files) {
    const message = validateUploadFile(file)
    if (message)
      throw new Error(message)
  }
}
