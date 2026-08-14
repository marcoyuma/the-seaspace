import { StarIcon } from "@phosphor-icons/react/dist/ssr";

export default function RatingStars({ rating }: { rating: number }) {
    return (
        <div className="flex flex-row" aria-label={`${rating} out of 5 stars`}>
            {Array.from({ length: rating }, (_, star) => (
                <StarIcon key={star} weight="fill" fill="#FFC533" size={24} />
            ))}
        </div>
    );
}
