// TopicNav.jsx
// Topic/category tab navigation
// Stagger-in animation (100ms delay each item)
// Debounced switching handled in useNews

const TOPICS = [
  { id: 'all',        en: 'All',                  ar: 'الكل' },
  { id: 'vision2030', en: 'Vision 2030',           ar: 'رؤية 2030' },
  { id: 'ai',         en: 'AI & Robotics',         ar: 'الذكاء الاصطناعي' },
  { id: 'neom',       en: 'NEOM & Giga Projects',  ar: 'نيوم' },
  { id: 'startups',   en: 'Startups',              ar: 'الشركات الناشئة' },
  { id: 'cyber',      en: 'Cybersecurity',         ar: 'الأمن السيبراني' },
  { id: 'telecom',    en: 'Telecom & 5G',          ar: 'الاتصالات' },
  { id: 'gaming',     en: 'Gaming & Entertainment',ar: 'الترفيه' },
];

export default function TopicNav({ activeTopic, onTopicChange, language }) {
  return (
    <nav className="topic-nav" aria-label="Topic navigation">
      {TOPICS.map((topic, idx) => (
        <button
          key={topic.id}
          className={`topic-btn${activeTopic === topic.id ? ' active' : ''}`}
          onClick={() => onTopicChange(topic.id)}
          style={{ animationDelay: `${idx * 100}ms` }}
          type="button"
          aria-current={activeTopic === topic.id ? 'page' : undefined}
        >
          {language === 'ar' ? topic.ar : topic.en}
        </button>
      ))}
    </nav>
  );
}
