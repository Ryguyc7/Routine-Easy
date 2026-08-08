"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const liquidButtonVariants = cva(
  "inline-flex items-center justify-center cursor-pointer gap-2 whitespace-nowrap rounded-full font-semibold transition-[color,transform,filter] duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-3 focus-visible:ring-[#6c5ce7]/25 text-[#5f4de0] bg-transparent hover:scale-105 active:scale-[.97]",
  {
    variants: {
      size: {
        default: "h-10 px-5 text-sm",
        sm: "h-8 px-4 text-xs",
        lg: "h-12 px-7 text-sm",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { size: "default" },
  },
);

type LiquidButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof liquidButtonVariants> & { asChild?: boolean };

function LiquidButton({ className, size, asChild = false, children, ...props }: LiquidButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="liquid-button"
      className={cn("relative isolate", liquidButtonVariants({ size, className }))}
      {...props}
    >
      <span className="liquid-glass-surface" aria-hidden="true" />
      <span
        className="absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
        style={{ backdropFilter: 'url("#routineez-liquid-glass")' }}
        aria-hidden="true"
      />
      <span className="liquid-button-content pointer-events-none relative z-10">{children}</span>
      <GlassFilter />
    </Comp>
  );
}

function GlassFilter() {
  return (
    <svg className="hidden" aria-hidden="true">
      <defs>
        <filter id="routineez-liquid-glass" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="turbulence" />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="70" xChannelSelector="R" yChannelSelector="B" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

export { LiquidButton, liquidButtonVariants };
