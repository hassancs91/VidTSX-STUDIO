import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { AIChatMessage } from '../../hooks/useAIChat';
import { formatDuration } from './utils/format';

export function MessageBubble({ message, selected, onSelect }: { message: AIChatMessage; selected: boolean; onSelect: () => void }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div
          onClick={onSelect}
          className={`max-w-[85%] px-3 py-2 rounded-[12px] rounded-br-[4px] text-[13px] leading-relaxed cursor-pointer transition-all ${selected ? 'ring-2 ring-white/30' : ''}`}
          style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
        >
          {message.images && message.images.length > 0 && (
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {message.images.map((img, i) => (
                <img
                  key={i}
                  src={`data:${img.mediaType};base64,${img.data}`}
                  alt={img.name}
                  className="rounded-[6px] max-h-[80px] max-w-[120px] object-cover"
                  style={{ border: '1px solid rgba(255,255,255,0.2)' }}
                />
              ))}
            </div>
          )}
          <span className="whitespace-pre-wrap">{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[90%] flex flex-col gap-1">
        <div className="flex items-center gap-2 px-1">
          {message.model && <span className="text-[9px] text-text-dim">{message.model}</span>}
          {message.durationMs != null && <span className="text-[9px] text-text-dim">{formatDuration(message.durationMs)}</span>}
          {message.thinking && <span className="text-[9px] text-accent">has thinking</span>}
        </div>
        <div
          onClick={onSelect}
          className={`px-3 py-2 rounded-[12px] rounded-bl-[4px] text-[13px] leading-relaxed text-text-primary overflow-hidden cursor-pointer transition-all ${selected ? 'ring-2 ring-accent/50' : ''}`}
          style={{ backgroundColor: 'var(--color-app-elevated)' }}
        >
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeString = String(children).replace(/\n$/, '');
                if (match) {
                  return (
                    <SyntaxHighlighter
                      style={oneDark} language={match[1]} PreTag="div"
                      customStyle={{ margin: '8px 0', borderRadius: '6px', fontSize: '12px', maxHeight: '200px', overflow: 'auto' }}
                    >
                      {codeString}
                    </SyntaxHighlighter>
                  );
                }
                return (
                  <code className="px-1 py-0.5 rounded text-[12px]" style={{ backgroundColor: 'var(--color-app-base)' }} {...props}>
                    {children}
                  </code>
                );
              },
              p({ children }) { return <p className="mb-2 last:mb-0">{children}</p>; },
              ul({ children }) { return <ul className="list-disc pl-4 mb-2">{children}</ul>; },
              ol({ children }) { return <ol className="list-decimal pl-4 mb-2">{children}</ol>; },
            }}
          >
            {message.content}
          </Markdown>
        </div>
      </div>
    </div>
  );
}
