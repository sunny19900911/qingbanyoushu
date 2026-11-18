import { ChartNoAxesCombined, Dumbbell, NotebookPen } from "lucide-react";

export type AppView = "record" | "trend" | "training" | "knowledge";

const items: Array<{ view: AppView; label: string; Icon: typeof NotebookPen }> = [
  { view: 'knowledge', label: '知识·分析', Icon: NotebookPen },
  { view: "record", label: "记录", Icon: NotebookPen },
  { view: "trend", label: "趋势", Icon: ChartNoAxesCombined },
  { view: "training", label: "训练·教练", Icon: Dumbbell },
];

export function BottomNav({ active, onChange }: { active: AppView; onChange: (view: AppView) => void }) {
  return (
    <nav className="bottom-nav" aria-label="主要功能">
      {items.map(({ view, label, Icon }) => (
        <button
          type="button"
          key={view}
          className={active === view ? "bottom-nav__item is-active" : "bottom-nav__item"}
          onClick={() => onChange(view)}
          aria-current={active === view ? "page" : undefined}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
