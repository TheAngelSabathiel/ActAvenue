import QRCode from "qrcode";

/**
 * Generates a QR code (as a data URL / PNG buffer) encoding just the
 * reference code, not the full reservation payload - the door scanner
 * looks the code up server-side against the reservations table rather
 * than trusting anything embedded in the QR itself. Called at approval
 * time (or admin manual "confirmed" registration), never at initial booking.
 */
export async function generateQrPngBuffer(referenceCode: string): Promise<Buffer> {
  return QRCode.toBuffer(referenceCode, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 480,
  });
}

export async function generateQrDataUrl(referenceCode: string): Promise<string> {
  return QRCode.toDataURL(referenceCode, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 480,
  });
}
