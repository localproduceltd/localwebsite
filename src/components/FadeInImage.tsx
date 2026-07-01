"use client";

import { useEffect, useRef, useState } from "react";
import Image, { type ImageProps } from "next/image";

/**
 * next/image with a gentle fade-in once the photo loads, over whatever
 * placeholder sits behind it. Replaces the old `unoptimized` flag: images
 * are now resized/compressed by Next, and the fade covers the load so photos
 * ease in instead of snapping (which read as flicker). See website-tech.md.
 */
export default function FadeInImage({ className = "", ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // If the image is already cached, onLoad may fire before React attaches the
  // handler - catch that case so it doesn't stay stuck invisible.
  useEffect(() => {
    if (ref.current?.complete) setLoaded(true);
  }, []);

  return (
    <Image
      {...props}
      ref={ref}
      onLoad={() => setLoaded(true)}
      className={`transition duration-500 ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}
