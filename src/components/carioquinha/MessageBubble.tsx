type MessageBubbleProps = {
  author: "user" | "ai";
  children: string;
};

export function MessageBubble({ author, children }: MessageBubbleProps) {
  return (
    <article className={`carioquinha-message carioquinha-message--${author}`}>
      <span>{author === "ai" ? "IA Carioquinha" : "Voce"}</span>
      <p>{children}</p>
    </article>
  );
}
