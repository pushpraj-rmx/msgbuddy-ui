import Image from "next/image";
import type { ComponentProps } from "react";

type BrandLogoProps = Omit<ComponentProps<typeof Image>, "src" | "alt"> & {
  alt?: string;
};

export function BrandLogo({ alt, ...props }: BrandLogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt={alt ?? "MsgBuddy"}
      width={160}
      height={32}
      priority={props.priority ?? false}
      {...props}
    />
  );
}

