import { useState } from "react";
import type { ImgHTMLAttributes } from "react";

interface ImgProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "loading" | "decoding"> {
  fallback?: string;
}

/** Image with graceful fallback so a dead CDN URL never breaks the layout. */
export function Img({ src, alt = "", fallback, onError, ...rest }: ImgProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <span
        aria-label={alt}
        role={alt ? "img" : undefined}
        style={{
          display: "grid",
          placeItems: "center",
          width: "100%",
          height: "100%",
          color: "var(--text-soft)",
          fontSize: "0.7rem",
          fontWeight: 650,
          letterSpacing: "0.06em",
          background:
            "linear-gradient(140deg, var(--surface-raised), var(--bg-sunken))",
        }}
      >
        {(fallback ?? alt).slice(0, 3).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
      {...rest}
    />
  );
}
