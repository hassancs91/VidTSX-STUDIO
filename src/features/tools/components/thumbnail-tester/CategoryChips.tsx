const CATEGORIES = [
  'All',
  'Gaming',
  'Music',
  'Mixes',
  'Live',
  'News',
  'Recently uploaded',
  'Watched',
  'Podcasts',
  'Coding',
  'AI',
  'Design',
  'Cooking',
  'Tech',
  'Science',
  'Sports',
  'Travel',
];

export function CategoryChips() {
  return (
    <div
      className="flex items-center gap-3 px-6 py-3 overflow-x-auto shrink-0"
      style={{ backgroundColor: '#0f0f0f', borderBottom: '1px solid #272727' }}
    >
      {CATEGORIES.map((cat, i) => (
        <span
          key={cat}
          className="shrink-0 px-3 py-[6px] rounded-lg text-[14px]"
          style={{
            fontFamily: 'Roboto, Arial, sans-serif',
            fontWeight: 500,
            backgroundColor: i === 0 ? '#f1f1f1' : '#272727',
            color: i === 0 ? '#0f0f0f' : '#f1f1f1',
            cursor: 'default',
          }}
        >
          {cat}
        </span>
      ))}
    </div>
  );
}
