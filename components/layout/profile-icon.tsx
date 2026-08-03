import Link from "next/link";
import { UserCircleIcon } from "@phosphor-icons/react/dist/ssr";

function ProfileIcon() {
    return (
        <Link href="/" className="flex items-center gap-4 z-10">
            <UserCircleIcon
                size={38}
                color="#000000"
                weight="fill"
                alt="profile icon"
            />
        </Link>
    );
}

export default ProfileIcon;
