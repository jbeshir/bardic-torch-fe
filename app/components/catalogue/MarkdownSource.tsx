/**
 * An API `*_md` field shown as written (its Markdown source), one
 * paragraph per blank-line-separated block, line breaks kept. The text is
 * the reader's own, so it is only ever text: never HTML, never a link.
 */
export function MarkdownSource({ text }: { readonly text: string }) {
  const seen = new Map<string, number>();
  const paragraphs = text
    .split(/\n[ \t]*\n/)
    .map(block => block.trim())
    .filter(block => block !== "")
    .map(block => {
      // A repeated paragraph is keyed by its repeat.
      const repeat = seen.get(block) ?? 0;
      seen.set(block, repeat + 1);
      return { block, key: `${repeat}:${block}` };
    });
  return (
    <>
      {paragraphs.map(({ block, key }) => (
        <p key={key} className="whitespace-pre-line">
          {block}
        </p>
      ))}
    </>
  );
}
