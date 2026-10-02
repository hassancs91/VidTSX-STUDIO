import { useMemo, useState } from 'react';
import type { TemplateIpc } from '@shared/ipc/types';
import { TemplateCard } from './TemplateCard';
import { categoryLabel } from './template-labels';

interface TemplateGalleryProps {
  templates: TemplateIpc[];
  loading: boolean;
  error: string | null;
  onOpen: (template: TemplateIpc) => void;
  /** Install a `.vidtsxtemplate` (the OS picker). */
  onImport: () => void;
  importing: boolean;
  onRemove: (template: TemplateIpc) => void;
}

const ALL = '';

function matches(template: TemplateIpc, query: string): boolean {
  const { name, description, category, tags } = template.manifest;
  return [name, description, category, ...tags].some((field) => field.toLowerCase().includes(query));
}

/** Templates mode, nothing open: search, category pills, and the card grid. */
export function TemplateGallery({ templates, loading, error, onOpen, onImport, importing, onRemove }: TemplateGalleryProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);

  const categories = useMemo(
    () => [...new Set(templates.map((t) => t.manifest.category))].sort(),
    [templates],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter(
      (t) => (category === ALL || t.manifest.category === category) && (q === '' || matches(t, q)),
    );
  }, [templates, query, category]);

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-template-gallery>
      <div className="px-3 pb-2 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates"
            spellCheck={false}
            className="flex-1 min-w-0 h-[26px] bg-app-base text-text-primary rounded-[6px] px-2 outline-none text-[11px]"
            style={{ border: '0.5px solid var(--color-border-input)' }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--color-accent)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--color-border-input)'; }}
          />
          <button
            onClick={onImport}
            disabled={importing}
            title="Install a .vidtsxtemplate file"
            data-template-import
            className="shrink-0 h-[26px] px-2 rounded-[6px] text-[10px] text-text-muted hover:bg-app-hover hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
            style={{ border: '0.5px solid var(--color-border)' }}
          >
            {importing ? 'Importing…' : 'Import…'}
          </button>
        </div>
        {/* Pills earn their row only once there is something to choose between. */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {[ALL, ...categories].map((c) => (
              <button
                key={c || 'all'}
                onClick={() => setCategory(c)}
                className={`px-2 py-[4px] rounded-[6px] text-[10px] transition-colors duration-150 cursor-pointer ${
                  category === c ? 'bg-accent text-white' : 'text-text-muted hover:bg-app-hover'
                }`}
                style={{ border: category === c ? '0.5px solid transparent' : '0.5px solid var(--color-border)' }}
              >
                {c === ALL ? 'All' : categoryLabel(c)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {error && <div className="text-[11px] text-accent-red pb-2">{error}</div>}
        {loading && templates.length === 0 ? (
          <div className="text-[11px] text-text-dim py-6 text-center">Loading templates…</div>
        ) : visible.length === 0 ? (
          <div className="text-[11px] text-text-dim py-6 text-center leading-relaxed">
            {templates.length === 0 ? 'No templates installed yet.' : 'No templates match your search.'}
          </div>
        ) : (
          <div className="grid gap-[10px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {visible.map((t) => (
              <TemplateCard key={t.manifest.id} template={t} onOpen={onOpen} onRemove={onRemove} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
