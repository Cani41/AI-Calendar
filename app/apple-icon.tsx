import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #4f46e5 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="104" height="104" viewBox="0 0 34 34" fill="none">
          <rect x="3" y="7" width="22" height="20" rx="3" stroke="white" strokeWidth="1.6" fill="none" strokeOpacity="0.9"/>
          <rect x="3" y="7" width="22" height="7" rx="3" fill="white" fillOpacity="0.15"/>
          <line x1="3" y1="14" x2="25" y2="14" stroke="white" strokeWidth="1.4" strokeOpacity="0.5"/>
          <line x1="9" y1="5" x2="9" y2="9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="19" y1="5" x2="19" y2="9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          <circle cx="9" cy="19" r="1.3" fill="white" fillOpacity="0.7"/>
          <circle cx="14" cy="19" r="1.3" fill="white" fillOpacity="0.7"/>
          <circle cx="19" cy="19" r="1.3" fill="white" fillOpacity="0.7"/>
          <circle cx="9" cy="24" r="1.3" fill="white" fillOpacity="0.7"/>
          <circle cx="14" cy="24" r="1.3" fill="white" fillOpacity="0.7"/>
          <path d="M28 4 L29.1 7.9 L33 9 L29.1 10.1 L28 14 L26.9 10.1 L23 9 L26.9 7.9 Z" fill="white" opacity="0.95"/>
        </svg>
      </div>
    ),
    { ...size }
  );
}
