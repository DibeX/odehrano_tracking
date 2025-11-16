import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  nickname: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  showName?: boolean;
  nameClassName?: string;
  showFallback?: boolean;
}

const sizeClasses = {
  xs: "w-5 h-5 text-[10px]",
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
  xl: "w-24 h-24 text-2xl",
};

function getInitials(nickname: string): string {
  return nickname
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function UserAvatar({
  nickname,
  avatarUrl,
  size = "sm",
  className,
  showName = false,
  nameClassName,
  showFallback = true,
}: UserAvatarProps) {
  const initials = getInitials(nickname);

  // If no avatar and no fallback desired, render nothing (or just the name if showName)
  if (!avatarUrl && !showFallback) {
    if (showName) {
      return (
        <span className={cn("font-medium", nameClassName)}>{nickname}</span>
      );
    }
    return null;
  }

  const avatarElement = (
    <Avatar className={cn(sizeClasses[size], className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={nickname} />}
      <AvatarFallback className={cn(sizeClasses[size])}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  if (!showName) {
    return avatarElement;
  }

  return (
    <div className="flex items-center gap-2">
      {avatarElement}
      <span className={cn("font-medium", nameClassName)}>{nickname}</span>
    </div>
  );
}
