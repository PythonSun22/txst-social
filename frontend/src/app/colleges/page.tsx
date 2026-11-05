import { DM_Sans, Space_Grotesk } from "next/font/google";
import CollegeCarousel from "@/components/colleges/CollegeCarousel";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-college-body" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-college-heading" });

export default function Colleges() {
  return <div className={`${dmSans.variable} ${spaceGrotesk.variable}`}><CollegeCarousel /></div>;
}
