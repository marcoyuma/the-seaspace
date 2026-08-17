import Link from "next/link";
// import Image from "next/image";
// import logo from "@/public/navbar-logo.png";
function Logo() {
    return (
        <Link href="/" className="flex items-center gap-4 z-10">
            {/* Scales in step with the bar's own responsive inset (48px mobile
                → 64px sm → 128px md → 240px lg in Header) so the wordmark
                doesn't dominate the collapsed pill at small viewports. */}
            <span className="font-logo tracking-tighter text-[22px] font-semibold text-black sm:text-[24px] md:text-[28px] lg:text-[32px]">
                seaspace
            </span>
        </Link>
    );
}

export default Logo;
