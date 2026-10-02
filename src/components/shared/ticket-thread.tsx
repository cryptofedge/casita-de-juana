import Image from "next/image";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/dates";
import { FileLink } from "@/components/shared/page";

interface Attachment {
  id: string;
  file: { id: string; filename: string; mime: string };
  messageId: string | null;
}

interface Message {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; role: "OWNER" | "TENANT" };
}

function Photos({ items }: { items: Attachment[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((a) =>
        a.file.mime.startsWith("image/") && a.file.mime !== "image/heic" ? (
          <a key={a.id} href={`/api/files/${a.file.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${a.file.filename}`}>
            <Image src={`/api/files/${a.file.id}`} alt={a.file.filename} width={96} height={96} unoptimized className="size-24 rounded-lg border object-cover" />
          </a>
        ) : (
          <FileLink key={a.id} id={a.file.id} name={a.file.filename} mime={a.file.mime} />
        ),
      )}
    </div>
  );
}

/** The ticket description + conversation. `viewerId` decides which side bubbles sit on. */
export function TicketThread({
  description,
  createdAt,
  authorName,
  messages,
  attachments,
  viewerId,
  locale = "en",
  ownerLabel = "Owner",
}: {
  description: string;
  createdAt: Date;
  authorName: string;
  messages: Message[];
  attachments: Attachment[];
  viewerId: string;
  locale?: "en" | "es";
  ownerLabel?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-1 text-xs text-muted-foreground">{authorName} · {fmtDate(createdAt, locale)}</div>
        <p className="whitespace-pre-wrap text-[15px]">{description}</p>
        <Photos items={attachments.filter((a) => !a.messageId)} />
      </div>
      {messages.map((m) => {
        const mine = m.author.id === viewerId;
        return (
          <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5", mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-card")}>
              <div className={cn("mb-0.5 text-xs", mine ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {m.author.role === "OWNER" ? ownerLabel : m.author.name} · {fmtDate(m.createdAt, locale)}
              </div>
              <p className="whitespace-pre-wrap text-[15px]">{m.body}</p>
              <Photos items={attachments.filter((a) => a.messageId === m.id)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
