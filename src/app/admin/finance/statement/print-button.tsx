"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

export function PrintButton() {
  const { t } = useT();
  return (
    <Button onClick={() => window.print()}>
      <Printer /> {t("Print / Save as PDF")}
    </Button>
  );
}
