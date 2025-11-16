"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

interface ResponsiveTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  contentClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  delayDuration?: number;
}

function ResponsiveTooltip({
  children,
  content,
  contentClassName,
  side = "top",
  align = "center",
  sideOffset = 4,
  delayDuration = 0,
}: ResponsiveTooltipProps) {
  const [isTouchDevice, setIsTouchDevice] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    // Check if device supports touch
    const checkTouch = () => {
      setIsTouchDevice(
        "ontouchstart" in window ||
          navigator.maxTouchPoints > 0 ||
          window.matchMedia("(pointer: coarse)").matches
      );
    };

    checkTouch();

    // Listen for changes (e.g., connecting/disconnecting touch devices)
    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const handleChange = () => checkTouch();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // On touch devices, use Popover (click to open/close)
  if (isTouchDevice) {
    return (
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          {children}
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            data-slot="responsive-tooltip-content"
            side={side}
            align={align}
            sideOffset={sideOffset}
            className={cn(
              "bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-popover-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
              contentClassName
            )}
          >
            {content}
            <PopoverPrimitive.Arrow className="bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]" />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  }

  // On desktop, use Tooltip (hover to show)
  // Note: TooltipProvider should be wrapped at app level
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          data-slot="responsive-tooltip-content"
          side={side}
          align={align}
          sideOffset={sideOffset}
          className={cn(
            "bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
            contentClassName
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export { ResponsiveTooltip };
export type { ResponsiveTooltipProps };
