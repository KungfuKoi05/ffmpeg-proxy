import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-1 focus-visible:ring-offset-base disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-ink hover:bg-accent-strong",
        secondary: "bg-elevated text-ink border border-line hover:border-line-strong hover:bg-overlay",
        ghost: "text-ink-muted hover:bg-elevated hover:text-ink",
        outline: "border border-line-strong text-ink hover:bg-elevated",
        danger: "bg-signal-red/15 text-signal-red border border-signal-red/40 hover:bg-signal-red/25",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs [&_svg]:size-3.5",
        md: "h-9 px-4 text-sm [&_svg]:size-4",
        lg: "h-11 px-6 text-sm [&_svg]:size-4",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
