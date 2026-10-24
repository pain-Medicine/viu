// Arrow-key focus movement for the web build, so a keyboard or a TV browser
// remote behaves like the Android TV D-pad. Native TV builds use the
// platform's own focus engine and never load this.
type Dir = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

function focusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[tabindex="0"], input, button')).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !el.closest('[aria-hidden="true"]');
  });
}

function pick(from: DOMRect, dir: Dir, candidates: HTMLElement[]): HTMLElement | null {
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const ahead =
      dir === 'ArrowRight' ? r.left >= from.right - 2 :
      dir === 'ArrowLeft' ? r.right <= from.left + 2 :
      dir === 'ArrowDown' ? r.top >= from.bottom - 2 :
      r.bottom <= from.top + 2;
    if (!ahead) continue;
    const along = dir === 'ArrowLeft' || dir === 'ArrowRight' ? Math.abs(dx) : Math.abs(dy);
    const across = dir === 'ArrowLeft' || dir === 'ArrowRight' ? Math.abs(dy) : Math.abs(dx);
    // Prefer staying in the same row or column.
    const score = along + across * 3;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

export function installSpatialNavigation(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const active = document.activeElement as HTMLElement | null;
    const all = focusables();
    if (active?.tagName === 'INPUT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    if (!active || active === document.body || !all.includes(active)) {
      all[0]?.focus();
      e.preventDefault();
      return;
    }
    const next = pick(active.getBoundingClientRect(), e.key as Dir, all.filter((el) => el !== active));
    if (next) {
      next.focus();
      next.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      e.preventDefault();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
