const STEPS = [
  { num: 1, title: "Загрузка", desc: "Загрузите документы в хранилище" },
  { num: 2, title: "Индексация", desc: "Система создаёт поисковые индексы" },
  { num: 3, title: "Поиск и чаты", desc: "Ищите и задавайте вопросы AI по документам" },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-16">
      <div className="container mx-auto max-w-5xl">
        <h2 className="mb-10 text-center text-2xl font-bold text-foreground sm:text-3xl">
          Как это работает
        </h2>
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-center sm:gap-12">
          {STEPS.map((s) => (
            <div key={s.num} className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20 text-lg font-bold text-primary">
                {s.num}
              </span>
              <div>
                <h3 className="font-semibold text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
