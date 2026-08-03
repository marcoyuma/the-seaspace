import Heading from "@/components/ui/heading";
import OverlineText from "@/components/ui/overline-text";
import {
    ArrowDownIcon,
    ArrowUpIcon,
    StarIcon,
    UserCircleIcon,
} from "@phosphor-icons/react/dist/ssr";

export default function Reviews() {
    return (
        <div className="mb-27.5">
            <div className="flex flex-col justify-center items-center gap-6.5 mb-17.5">
                <OverlineText>Reviews</OverlineText>
                <Heading>Read our guests thought</Heading>
            </div>
            <div className="flex flex-col justify-center items-center gap-6.5">
                <div className="flex flex-row justify-between border border-black/10 rounded-[20px] w-161 h-47.25 px-6.5 py-4.75">
                    <div className=" flex flex-col gap-2.5">
                        <div className="flex gap-1">
                            <UserCircleIcon
                                size={54}
                                color="black"
                                weight="fill"
                            />
                            <div className="flex flex-col gap-0 inset-0 justify-center">
                                <h3 className="text-[16px] font-semibold text-black">
                                    Genie Junior
                                </h3>
                                <p className="text-[16px] font-semibold text-black/30">
                                    Dubai, UEA
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-row">
                            <StarIcon weight="fill" fill="#FFC533" size={24} />
                            <StarIcon weight="fill" fill="#FFC533" size={24} />
                            <StarIcon weight="fill" fill="#FFC533" size={24} />
                            <StarIcon weight="fill" fill="#FFC533" size={24} />
                            <StarIcon weight="fill" fill="#FFC533" size={24} />
                        </div>

                        <p className="text-[16px] text-black/60 font-medium w-97.5">
                            “It felt like a private retreat. Everything was
                            effortless . from check-in to the little design
                            details”
                        </p>
                    </div>
                    <div className="flex flex-col gap-2.25 justify-center">
                        <div className="flex justify-center items-center bg-[#D9D9D9]/30 rounded-[20px] w-14.25 h-14.25 cursor-pointer">
                            <ArrowUpIcon size={27} fill="black" />
                        </div>
                        <div className="flex justify-center items-center bg-[#D9D9D9]/30 rounded-[20px] w-14.25 h-14.25 cursor-pointer">
                            <ArrowDownIcon size={27} fill="black" />
                        </div>
                    </div>
                </div>
                <div className="flex flex-row justify-evenly items-center border rounded-[20px] border-black/10 w-161 px-6.5 py-4.75">
                    <div>
                        <h3 className="font-semibold text-[24px] tracking-[0.5%]">
                            200+
                        </h3>
                        <span className="text-black/50">Reviews</span>
                    </div>
                    <div className="w-px h-[51px] bg-black/10" />
                    <div>
                        <h3 className="font-semibold text-[24px] tracking-[0.5%]">
                            5.00
                        </h3>
                        <span className="text-black/50">Ratings</span>
                    </div>
                    <div className="w-px h-[51px] bg-black/10" />
                    <div>
                        <h3 className="font-semibold text-[24px] tracking-[0.5%]">
                            100%
                        </h3>
                        <span className="text-black/50">Reply rate</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
