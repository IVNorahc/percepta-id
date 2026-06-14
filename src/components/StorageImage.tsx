import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { getSignedUrl } from '../lib/storage'

// Affiche une image stockée dans le bucket privé via une URL signée.
// Tant que l'URL n'est pas résolue (ou si absente), affiche `fallback`.
export default function StorageImage({
  src,
  alt = '',
  className,
  style,
  fallback = null,
}: {
  src: string | null | undefined
  alt?: string
  className?: string
  style?: CSSProperties
  fallback?: ReactNode
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    if (src) {
      getSignedUrl(src).then((u) => {
        if (!cancelled) setUrl(u)
      })
    }
    return () => {
      cancelled = true
    }
  }, [src])

  if (!url) return <>{fallback}</>
  return <img src={url} alt={alt} className={className} style={style} />
}
