import { Fragment, memo, useMemo, type ReactNode } from 'react';
import { t } from '../../i18n';
import { cx } from '../../shared/ui/primitives';
import { parseMarkdown, type Block, type Inline } from './markdown';

interface Props {
  source: string;
  onToggleTask: (line: number) => void;
  onOpenLink: (url: string) => void;
}

/** Markdown önizlemesi: ayrıştırılmış ağaçtan React öğeleri (ham HTML asla eklenmez). */
export const MarkdownView = memo(function MarkdownView({ source, onToggleTask, onOpenLink }: Props) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  if (blocks.length === 0) return <p className="text-sm text-faint">{t('notebook.previewEmpty')}</p>;
  return (
    <div className="selectable flex flex-col gap-3 text-base leading-relaxed text-fg">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} onToggleTask={onToggleTask} onOpenLink={onOpenLink} />
      ))}
    </div>
  );
});

function BlockView({ block, onToggleTask, onOpenLink }: { block: Block } & Omit<Props, 'source'>) {
  const inline = (nodes: Inline[]) => <InlineView nodes={nodes} onOpenLink={onOpenLink} />;
  switch (block.type) {
    case 'heading': {
      const cls = cx(
        'font-display font-semibold tracking-tight',
        block.level === 1 ? 'text-2xl' : block.level === 2 ? 'text-xl' : 'text-lg',
      );
      if (block.level === 1) return <h1 className={cls}>{inline(block.content)}</h1>;
      if (block.level === 2) return <h2 className={cls}>{inline(block.content)}</h2>;
      return <h3 className={cls}>{inline(block.content)}</h3>;
    }
    case 'paragraph':
      return (
        <p>
          {block.lines.map((l, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {inline(l)}
            </Fragment>
          ))}
        </p>
      );
    case 'quote':
      return (
        <blockquote className="border-l-[3px] border-accent/60 pl-3 text-muted">
          {block.lines.map((l, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {inline(l)}
            </Fragment>
          ))}
        </blockquote>
      );
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-xl bg-surface-2 px-3 py-2 font-mono text-sm shadow-[inset_0_0_0_1px_var(--glass-edge)]">
          {block.text}
        </pre>
      );
    case 'hr':
      return <hr className="border-line" />;
    case 'list': {
      const items = block.items.map((item) => (
        <li
          key={item.line}
          style={{ marginLeft: item.depth * 20 - (item.task !== null ? 24 : 0) }}
          className={cx(item.task !== null && 'flex list-none items-start gap-2')}
        >
          {item.task !== null ? (
            <>
              <input
                type="checkbox"
                checked={item.task}
                onChange={() => onToggleTask(item.line)}
                aria-label={item.content.map(plain).join('')}
                className="mt-1.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span className={cx(item.task && 'text-faint line-through')}>{inline(item.content)}</span>
            </>
          ) : (
            inline(item.content)
          )}
        </li>
      ));
      return block.ordered ? (
        <ol start={block.start} className="flex list-decimal flex-col gap-1 pl-6 marker:text-faint">
          {items}
        </ol>
      ) : (
        <ul className="flex list-disc flex-col gap-1 pl-6 marker:text-accent">{items}</ul>
      );
    }
  }
}

function plain(node: Inline): string {
  switch (node.type) {
    case 'text':
    case 'code':
      return node.text;
    case 'link':
      return node.text;
    case 'bold':
    case 'italic':
      return node.children.map(plain).join('');
  }
}

function InlineView({ nodes, onOpenLink }: { nodes: Inline[]; onOpenLink: (url: string) => void }): ReactNode {
  return nodes.map((n, i) => {
    switch (n.type) {
      case 'text':
        return <Fragment key={i}>{n.text}</Fragment>;
      case 'code':
        return (
          <code key={i} className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-sm">
            {n.text}
          </code>
        );
      case 'bold':
        return (
          <strong key={i} className="font-semibold">
            <InlineView nodes={n.children} onOpenLink={onOpenLink} />
          </strong>
        );
      case 'italic':
        return (
          <em key={i}>
            <InlineView nodes={n.children} onOpenLink={onOpenLink} />
          </em>
        );
      case 'link':
        return (
          <a
            key={i}
            href={n.href}
            title={t('notebook.linkHint', { url: n.href })}
            onClick={(e) => {
              e.preventDefault();
              onOpenLink(n.href);
            }}
            className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          >
            {n.text}
          </a>
        );
    }
  });
}
