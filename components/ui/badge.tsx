import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
        teal: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-300",
        green: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300",
        yellow: "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300",
        red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
        blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
        gray: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
