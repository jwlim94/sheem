import { useRef } from 'react';
import { experiences } from './experience';

export function ExperienceBook({
  page,
  onPageChange,
}: {
  page: number;
  onPageChange: (page: number) => void;
}) {
  const chapter = experiences[page];
  const heading = useRef<HTMLHeadingElement>(null);
  const turn = (next: number) => {
    onPageChange(next);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'nearest' });
    });
  };
  return (
    <div className="experience-book">
      <aside className="experience-index">
        <p className="portfolio-eyebrow">THE EXPERIENCE BOOK</p>
        <h2 id="portfolio-dialog-title">Work, in chapters.</h2>
        <p>
          Jongwoo Lim
          <br />
          <span>Full-Stack Software Engineer</span>
        </p>
        <nav aria-label="Experience chapters">
          {experiences.map((entry, index) => (
            <button
              key={entry.company}
              aria-current={index === page ? 'page' : undefined}
              onClick={() => turn(index)}
            >
              <span className="chapter-number">0{index + 1}</span>
              <span>
                {entry.company}
                {entry.period && <small>{entry.period}</small>}
              </span>
            </button>
          ))}
        </nav>
        <span className="experience-index-note">
          A few places where I’ve helped build things.
        </span>
      </aside>
      <section className="experience-page" aria-label="Selected experience">
        <div key={page} className="experience-page-content">
          <p className="portfolio-eyebrow">CHAPTER 0{page + 1} / EXPERIENCE</p>
          <h3 ref={heading} tabIndex={-1}>
            {chapter.company}
          </h3>
          <p className="experience-role">{chapter.role}</p>
          <p className="experience-meta">
            {[chapter.period, chapter.location].filter(Boolean).join(' · ')}
          </p>
          <p className="experience-theme">{chapter.theme}</p>
          <ul className="experience-highlights" aria-label="At a glance">
            {chapter.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h4>My contribution</h4>
          <ul className="experience-contributions">
            {chapter.contributions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <footer className="experience-pagination">
          <button disabled={page === 0} onClick={() => turn(page - 1)}>
            ← Previous
          </button>
          <span aria-live="polite">
            {page + 1} / {experiences.length}
          </span>
          <button
            disabled={page === experiences.length - 1}
            onClick={() => turn(page + 1)}
          >
            Next →
          </button>
        </footer>
      </section>
    </div>
  );
}
