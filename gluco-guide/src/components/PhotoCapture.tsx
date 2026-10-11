import { useId, type ChangeEvent, type ReactNode } from "react"

interface PhotoCaptureButtonProps {
  onCapture: (dataUrl: string) => void
  ariaLabel: string
  className: string
  children: ReactNode
}

// Resized/compressed before sending to the AI. 1568px is Claude's own
// native long-edge target for image input — anything larger just gets
// downscaled on their end anyway, but anything meaningfully smaller (the
// previous 800px cap) can blur small/dense label text enough to cause real
// misreads, confirmed after a Chinese candy label got mistranslated.
const MAX_DIMENSION = 1568
const JPEG_QUALITY = 0.85

// Resizes/compresses a photo the phone's native camera handed back. Reading
// it through an <img> (rather than createImageBitmap) means the browser
// applies the photo's EXIF orientation automatically when we draw it to the
// canvas — iPhone photos are frequently stored "sideways" with a rotation
// tag, and skipping this step would hand the AI a rotated image.
function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read that photo."))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error("Couldn't read that photo."))
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Couldn't process that photo."))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

// Opens the phone's own native camera app (the same one used for every
// other photo) via <input type="file" capture>, instead of a custom
// in-page live-preview screen — simpler and far more reliable across
// devices than driving getUserMedia ourselves, with no live video screen
// for anything to go wrong on.
export function PhotoCaptureButton({ onCapture, ariaLabel, className, children }: PhotoCaptureButtonProps) {
  const inputId = useId()

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const dataUrl = await resizeImageFile(file)
    onCapture(dataUrl)
  }

  return (
    <>
      <label htmlFor={inputId} aria-label={ariaLabel} className={`${className} cursor-pointer`}>
        {children}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void handleChange(e)}
        className="hidden"
      />
    </>
  )
}
