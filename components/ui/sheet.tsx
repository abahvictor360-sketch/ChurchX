"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-card shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=open]:duration-300",
          side === "right" && "inset-y-0 right-0 h-full w-[88%] max-w-md border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          side === "left" && "inset-y-0 left-0 h-full w-[85%] max-w-xs border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
          side === "bottom" && "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-xl border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          side === "top" && "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-4 right-4 rounded-sm p-1 opacity-70 hover:opacity-100 focus:ring-2 focus:ring-ring focus:outline-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-5 pb-0", className)} {...props} />;
}
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-auto flex flex-col gap-2 p-5", className)} {...props} />;
}
function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn("font-semibold", className)} {...props} />;
}
function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
