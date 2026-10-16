import { Marked } from "marked";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Raw HTML in the source is shown as text, never rendered; links open safely.
const marked = new Marked({
  gfm: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, text }) {
      const safe = /^(https?:|mailto:|\/|#)/i.test(href ?? "") ? href : "#";
      const external = /^https?:/i.test(safe ?? "");
      return `<a href="${escapeHtml(safe ?? "#")}"${external ? ' target="_blank" rel="noreferrer noopener"' : ""}>${escapeHtml(text)}</a>`;
    },
  },
});

export function Markdown({ source, className }: { source: string; className?: string }) {
  const html = marked.parse(source, { async: false }) as string;
  return <div className={`prose-fb ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
