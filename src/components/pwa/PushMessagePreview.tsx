"use client";

import { Bell } from "lucide-react";

type PushMessagePreviewProps = {
  title: string;
  text: string;
  image?: string;
};

export function PushMessagePreview({ title, text, image }: PushMessagePreviewProps) {
  return (
    <div className="rounded-xl border bg-white shadow-sm p-3 max-w-xs">
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100">
          <Bell className="h-4 w-4 text-purple-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 line-clamp-1">{title || "Push Title"}</p>
          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{text || "Push message body..."}</p>
        </div>
      </div>
      {image && (
        <div className="mt-2 rounded-lg overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Push image" className="w-full h-32 object-cover" />
        </div>
      )}
    </div>
  );
}
