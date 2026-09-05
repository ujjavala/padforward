import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f766e",
          borderRadius: 36,
        }}
      >
        <svg width="120" height="120" viewBox="0 0 64 64">
          <path
            d="M32 47c-.6 0-1.2-.2-1.7-.6C25 42.2 16 34.6 16 26.8 16 21.4 20.3 17 25.6 17c2.5 0 4.8 1 6.4 2.7A8.9 8.9 0 0 1 38.4 17C43.7 17 48 21.4 48 26.8c0 7.8-9 15.4-14.3 19.6-.5.4-1.1.6-1.7.6z"
            fill="#ffffff"
          />
          <circle cx="32" cy="27.5" r="3.2" fill="#0f766e" />
        </svg>
      </div>
    ),
    size
  );
}
