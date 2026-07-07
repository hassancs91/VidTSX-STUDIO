import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { PrototyperChatMessage } from '../types';

function stripHtmlCodeBlock(text: string): string {
  return text.replace(/```html\s*\n[\s\S]*?```/g, '').trim();
}

interface ChatMessageProps {
  message: PrototyperChatMessage;
}

export function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div
          className="max-w-[85%] px-3 py-2 rounded-[12px] rounded-br-[4px] text-[13px] leading-relaxed"
          style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-3">
      <div
        className="max-w-[90%] px-3 py-2 rounded-[12px] rounded-bl-[4px] text-[13px] leading-relaxed text-text-primary overflow-hidden"
        style={{ backgroundColor: 'var(--color-app-elevated)' }}
      >
        {message.htmlCode && (
          <div
            className="inline-flex items-center gap-1 px-2 py-0.5 mb-2 rounded-full text-[10px] font-medium"
            style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.5 1A1.5 1.5 0 001 2.5v11A1.5 1.5 0 002.5 15h11a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0013.5 1h-11zM4 4h8v2H4V4zm0 3h8v6H4V7z" />
            </svg>
            Artifact generated
          </div>
        )}
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const codeString = String(children).replace(/\n$/, '');

              if (match) {
                return (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: '8px 0',
                      borderRadius: '6px',
                      fontSize: '12px',
                      maxHeight: '200px',
                      overflow: 'auto',
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                );
              }
              return (
                <code
                  className="px-1 py-0.5 rounded text-[12px]"
                  style={{ backgroundColor: 'var(--color-app-base)' }}
                  {...props}
                >
                  {children}
                </code>
              );
            },
            p({ children }) {
              return <p className="mb-2 last:mb-0">{children}</p>;
            },
            ul({ children }) {
              return <ul className="list-disc pl-4 mb-2">{children}</ul>;
            },
            ol({ children }) {
              return <ol className="list-decimal pl-4 mb-2">{children}</ol>;
            },
          }}
        >
          {stripHtmlCodeBlock(message.content)}
        </Markdown>
      </div>
    </div>
  );
}
