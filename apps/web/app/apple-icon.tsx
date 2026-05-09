import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#fff8f8",
          border: "10px solid #c5333f",
          borderRadius: 36,
          color: "#8f2330",
          display: "flex",
          fontSize: 88,
          fontWeight: 800,
          height: "100%",
          justifyContent: "center",
          letterSpacing: 0,
          width: "100%"
        }}
      >
        C
      </div>
    ),
    size
  );
}
