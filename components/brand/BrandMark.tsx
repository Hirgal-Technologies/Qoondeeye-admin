import Image from "next/image";

type BrandMarkProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function BrandMark({
  size = 36,
  className = "",
  priority = false,
}: BrandMarkProps) {
  return (
    <Image
      src="/app-icon.png"
      alt="Qoondeeye"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 rounded-md object-cover ${className}`.trim()}
    />
  );
}
