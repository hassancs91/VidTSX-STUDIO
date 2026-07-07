import type { NewsCategory, NewsItem } from '../../../shared/ipc/types';

interface NewsFeedProps {
  items: NewsItem[];
}

const categoryColors: Record<NewsCategory, string> = {
  tutorial: '#85B7EB',
  update: '#7F77DD',
  tip: '#5DCAA5',
  announcement: '#EF9F27',
};

const categoryLabels: Record<NewsCategory, string> = {
  tutorial: 'Tutorial',
  update: 'Update',
  tip: 'Tip',
  announcement: 'News',
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function openExternal(url: string) {
  window.api.appOpenExternal({ url });
}

export function NewsFeed({ items }: NewsFeedProps) {
  return (
    <div>
      <div className="text-[11px] text-text-dim uppercase tracking-wider mb-3">
        News & Tips
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const color = categoryColors[item.category] ?? '#7F77DD';
          const label = categoryLabels[item.category] ?? item.category;
          const clickable = Boolean(item.url);
          return (
            <div
              key={item.id}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => openExternal(item.url!) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openExternal(item.url!);
                      }
                    }
                  : undefined
              }
              className={`flex gap-3 bg-app-surface rounded-[8px] p-3 transition-colors duration-150 ${
                clickable ? 'hover:bg-app-hover cursor-pointer' : ''
              }`}
              style={{ border: '0.5px solid var(--color-border)' }}
            >
              <div
                className="w-[3px] rounded-full shrink-0 self-stretch"
                style={{ backgroundColor: color }}
              />

              <div className="flex flex-col gap-1 min-w-0">
                <div className="text-[12px] text-text-primary font-medium leading-snug">
                  {item.title}
                </div>
                <div className="text-[10px] text-text-dim leading-relaxed line-clamp-2">
                  {item.excerpt}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-[3px]"
                    style={{
                      color,
                      backgroundColor: `${color}15`,
                    }}
                  >
                    {label}
                  </span>
                  <span className="text-[9px] text-text-dim">
                    {formatDate(item.date)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
