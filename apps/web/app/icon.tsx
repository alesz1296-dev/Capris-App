import { ImageResponse } from "next/og";

export const size = {
  width: 192,
  height: 192
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(160deg, #fffefe 0%, #f5d8dd 100%)",
          color: "#8f2330",
          display: "flex",
          fontSize: 92,
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
