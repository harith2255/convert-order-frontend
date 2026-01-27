import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const alertVariants = cva(
  "relative w-full rounded-2xl border px-6 py-5 text-base flex items-center gap-4 shadow-sm transition-all",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border-border",
        destructive:
          "border-red-100 bg-[#FFF5F5] text-[#E03131] [&>svg]:text-[#E03131] font-semibold",
        success:
          "border-green-100 bg-[#F2FBF5] text-[#1E7E34] [&>svg]:text-[#1E7E34] font-semibold",
        warning:
          "border-amber-100 bg-[#FFFBEB] text-[#92400E] [&>svg]:text-[#D97706] font-semibold",
        info:
          "border-blue-100 bg-[#F0F7FF] text-[#004085] [&>svg]:text-[#0056b3] font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
