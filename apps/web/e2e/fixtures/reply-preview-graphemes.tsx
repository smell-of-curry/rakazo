import { I18nProvider } from "@lingui/react";
import { messageReplyPreview } from "@rakazo/core/message-quote";
import { createRoot } from "react-dom/client";
import { bootstrapI18n, i18n } from "../../src/lib/i18n";
import { ReplyLine } from "../../src/pages/shell/chat-context";
import "../../src/styles.css";

await bootstrapI18n();
createRoot(document.getElementById("root")!).render(
  <I18nProvider i18n={i18n}>
    <main className="mx-auto max-w-lg space-y-4 p-6">
      {["😀", "👩‍💻", "🇧🇷", "👍🏽", "e\u0301"].map((cluster) => (
        <div key={cluster}>
          <ReplyLine
            author="Helper"
            message={{
              id: cluster,
              threadId: "fixture",
              seq: 1,
              role: "bot",
              createdAt: "2026-11-11T12:00:00Z",
              blocks: [],
              replyToMessageId: "parent",
              replyPreview: messageReplyPreview(
                [{ kind: "text", text: `${"x".repeat(279)}${cluster}tail` }],
                "user",
              ),
            }}
          />
          <ReplyLine
            author="Helper"
            message={{
              id: `${cluster}-short`,
              threadId: "fixture",
              seq: 2,
              role: "bot",
              createdAt: "2026-11-11T12:00:00Z",
              blocks: [],
              replyToMessageId: "parent",
              replyPreview: { role: "user", text: `Short ${cluster}` },
            }}
          />
        </div>
      ))}
    </main>
  </I18nProvider>,
);
