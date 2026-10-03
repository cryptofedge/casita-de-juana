"use client";

import { useState, useTransition } from "react";
import { updatePaymentMethodAction } from "@/actions/finance";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { useT } from "@/lib/i18n/provider";

/** Owner: change how an already-recorded payment was made (e.g. Cash -> Zelle). */
export function PaymentMethodSelect({ paymentId, method }: { paymentId: string; method: string }) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <select
        aria-label={t("Method")}
        className="h-9 rounded-md border bg-card px-2 text-sm"
        defaultValue={method}
        disabled={pending}
        onChange={(e) => {
          setError(null);
          const next = e.target.value;
          start(async () => {
            const r = await updatePaymentMethodAction(paymentId, next);
            if (!r.ok) setError(r.error);
          });
        }}
      >
        {Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => (
          <option key={v} value={v}>{t(l)}</option>
        ))}
      </select>
      {error && <span role="alert" className="ml-2 text-xs font-medium text-destructive">{t(error)}</span>}
    </>
  );
}
