import Link from "next/link";
// import Image from "next/image";
// import logo from "@/public/navbar-logo.png";
function Logo() {
    return (
        <Link href="/" className="flex items-center gap-4 z-10">
            <span className="font-logo tracking-tighter text-[32px] font-semibold text-black">
                seaspace
            </span>
        </Link>
    );
}

export default Logo;
