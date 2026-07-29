import Link from "next/link";
// import Image from "next/image";
// import logo from "@/public/navbar-logo.png";
import { Josefin_Sans } from "next/font/google";

const josefin = Josefin_Sans({
    subsets: ["latin"],
    display: "swap",
});

function Logo() {
    return (
        <Link href="/" className="flex items-center gap-4 z-10">
            <span
                className={`${josefin.className} tracking-tighter text-[32px] font-semibold text-black`}
            >
                seaspace
            </span>
        </Link>
    );
}

export default Logo;
