"use client";

import Heading from "@/ui/heading";
import OverlineText from "@/ui/overline-text";
import Text from "@/ui/text";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";

const questions = [
    {
        question: "What are your check-in and check-out times?",
        answer: "Check-in is from 3:00 PM and check-out is until 11:00 AM. Early check-in and late check-out can be arranged on request, subject to availability.",
    },
    {
        question: "Is the beach safe for swimming?",
        answer: "Yes, our private beach has calm, shallow waters that are regularly monitored. Flags indicate current conditions, and lifeguards are on duty during daytime hours.",
    },
    {
        question: "Are pets allowed at your property?",
        answer: "We warmly welcome well-behaved pets in select villas. Please let us know in advance so we can prepare bedding, bowls, and a few treats for your companion.",
    },
    {
        question: "Can you arrange water activities and beach excursions?",
        answer: "Absolutely. From snorkeling and paddleboarding to sunset sailing trips, our concierge can arrange a range of water activities tailored to your group.",
    },
    {
        // Replaced a verbatim duplicate of the beach question above. The arrival flow is
        // the thing guests actually ask about that this list never answered — see
        // features/booking/README.md.
        question: "How do we get into the villa when we arrive?",
        answer: "You choose when you book. Self check-in gives you a code to scan at the door, so there is nobody to meet and no arrival time to agree on. The lock box is the same code on a mechanical keypad, which keeps working with a flat phone and no signal. Either way the code reaches you the moment the booking is made, and it works at both doors.",
    },
    {
        question: "What activities are suitable for families with children?",
        answer: "Families can enjoy tide-pool exploring, sandcastle workshops, gentle kayak tours, and our supervised kids' club with games and creative activities.",
    },
];

export default function FaqSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <div className="pb-27.5 flex flex-col gap-6.5">
            <div className="flex flex-col justify-center items-center gap-6.5">
                <OverlineText>{"FAQ's"}</OverlineText>
                <Heading>Your Wonders</Heading>
                <Text>Answers for most wonderer wonders</Text>
            </div>
            <div className="flex flex-col justify-center items-center gap-2.5">
                {questions.map((item, index) => (
                    <Question
                        key={index}
                        question={item.question}
                        answer={item.answer}
                        isOpen={openIndex === index}
                        onToggle={() =>
                            setOpenIndex(openIndex === index ? null : index)
                        }
                    />
                ))}
            </div>
        </div>
    );
}

function Question({
    question,
    answer,
    isOpen,
    onToggle,
}: {
    question: string;
    answer: string;
    isOpen: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="flex flex-col px-4.25 py-4 w-161 border border-black/10 rounded-[20px]">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                className="flex flex-row justify-between items-center w-full cursor-pointer text-left"
            >
                <Text>{question}</Text>
                <PlusIcon
                    size={27}
                    fill="black"
                    className={`shrink-0 transition-transform duration-300 ease-out motion-reduce:transition-none ${
                        isOpen ? "rotate-45" : ""
                    }`}
                />
            </button>
            <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
            >
                <div className="overflow-hidden">
                    <Text classname="pt-3 !font-normal text-black/60">
                        {answer}
                    </Text>
                </div>
            </div>
        </div>
    );
}
