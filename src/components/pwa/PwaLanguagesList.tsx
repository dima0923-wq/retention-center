"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PwaFlowLanguage } from "@/types/pwaflow";

type PwaLanguagesListProps = {
  languages: PwaFlowLanguage[];
};

export function PwaLanguagesList({ languages }: PwaLanguagesListProps) {
  if (languages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No languages configured for this PWA.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {languages.map((lang) => (
        <Card key={lang.id ?? lang.lang}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {lang.name ?? lang.lang ?? "Unknown"}
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {lang.lang && (
                  <Badge variant="outline" className="text-xs uppercase">
                    {lang.lang}
                  </Badge>
                )}
                {lang.status && (
                  <Badge variant={lang.status === "active" ? "default" : "secondary"}>
                    {lang.status}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {lang.dev_name && <p>Developer: {lang.dev_name}</p>}
            {lang.rating != null && <p>Rating: {lang.rating}/5</p>}
            {lang.reviews_count != null && <p>Reviews: {lang.reviews_count.toLocaleString()}</p>}
            {lang.downloads != null && <p>Downloads: {lang.downloads.toLocaleString()}</p>}
            {lang.tags && lang.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {lang.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
