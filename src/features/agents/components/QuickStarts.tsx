// One-click sample prompts on an empty session (agents plan §1.9).
//
// A quick start is its OWN brief — the ChatGPT-style alternative to the tree,
// for a user who already knows what they want. Clicking one prefills the chat
// box rather than sending it, the same rule the starter's `opening` follows:
// the user always sees, and can edit, what is about to be sent.

interface Props {
  prompts: string[];
  disabled?: boolean;
  onPick: (prompt: string) => void;
}

export function QuickStarts({ prompts, disabled, onPick }: Props) {
  if (prompts.length === 0) return null;
  return (
    <div className="flex flex-col items-stretch gap-1 w-full max-w-[240px]" data-quick-starts>
      {prompts.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onPick(prompt)}
          disabled={disabled}
          data-quick-start
          className="rounded-[6px] bg-app-base px-2 py-1.5 text-left text-[11px] text-text-secondary leading-snug hover:bg-app-hover disabled:opacity-40"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
