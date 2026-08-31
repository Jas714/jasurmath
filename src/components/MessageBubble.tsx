"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents: Components = {
  // Keng jadval telefon ekranidan chiqib ketmasin - o'zi ichida sursin.
  table({ node, ...props }) {
    return (
      <div className="table-scroll">
        <table {...props} />
      </div>
    );
  },
  a({ node, ...props }) {
    return <a target="_blank" rel="noreferrer" {...props} />;
  },
};

export function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  if (role === "user") {
    return <div className="bubble bubble-user">{content}</div>;
  }

  return (
    <div className="bubble bubble-assistant">
      {content ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      ) : (
        <span className="typing" aria-label="JasurMath yozmoqda">
          <span />
          <span />
          <span />
        </span>
      )}
    </div>
  );
}
