declare module "react-qr-code" {
  import * as React from "react";

  export interface QRCodeProps {
    value: string;
    size?: number;
    bgColor?: string;
    fgColor?: string;
    className?: string;
  }

  const QRCode: React.FC<QRCodeProps>;
  export default QRCode;
}

