import { NextResponse } from "next/server";
import { IMAGES } from "@/lib/images";

// Browsers ask for /favicon.ico by default. Point it at the logo.
export function GET(req: Request) {
  return NextResponse.redirect(new URL(IMAGES.logo, req.url), 308);
}
