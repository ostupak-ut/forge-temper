/**
 * Ukrainian dictionary. Keys are the exact English source strings used across the
 * UI; anything missing here falls back to English (see i18n.tsx). Brand names
 * (FORGE, Forge, Temper, OpenRouter, Claude Code, Codex) are kept as-is.
 */
export const UK: Record<string, string> = {
  // ---- App shell (header / footer) ----
  'Visual Flow Modeller': 'Візуальний конструктор потоків',
  'Switch to light mode': 'Перемкнути на світлу тему',
  'Switch to dark mode': 'Перемкнути на темну тему',
  'How Forge works — legend & quickstart': 'Як працює Forge — легенда та швидкий старт',
  'backend offline': 'сервер недоступний',
  'connecting…': 'з’єднання…',
  'backend ok': 'сервер працює',
  'Open properties panel': 'Відкрити панель властивостей',
  Files: 'Файли',
  Settings: 'Налаштування',
  Language: 'Мова',
  English: 'English',
  Ukrainian: 'Українська',
  'Switch language': 'Змінити мову',

  // ---- Toolbar ----
  New: 'Новий',
  'New empty flow': 'Новий порожній потік',
  Starter: 'Шаблон',
  'Load the standard InfoCard → Loop[Forge↔Temper] → Body → Assemble workflow':
    'Завантажити стандартний потік: Картка → Цикл[Forge↔Temper] → Текст → Складання',
  'Design with AI': 'Створити через ШІ',
  'Describe a workflow in plain English — an AI designs the graph for you':
    'Опишіть потік звичайною мовою — ШІ побудує граф за вас',
  'Open or manage saved flows': 'Відкрити або керувати збереженими потоками',
  'No saved flows yet — use Save / Save As.': 'Ще немає збережених потоків — скористайтесь «Зберегти» / «Зберегти як».',
  Save: 'Зберегти',
  'Save (Ctrl+S)': 'Зберегти (Ctrl+S)',
  'Save As': 'Зберегти як',
  'Save as a new name': 'Зберегти під новою назвою',
  unsaved: 'не збережено',
  'Export to a .json file': 'Експортувати у файл .json',
  'Import a .json file': 'Імпортувати файл .json',
  'Dry Run': 'Пробний запуск',
  'Dry run — walks the flow order and animates edges/status WITHOUT calling any agent (no tokens spent). To really run, use Run Graph, or the ▶ on a node.':
    'Пробний запуск — проходить порядок потоку та анімує ребра/статуси БЕЗ виклику агентів (без витрат токенів). Для справжнього запуску використайте «Запустити граф» або ▶ на вузлі.',
  Parallel: 'Паралельно',
  Sequential: 'Послідовно',
  'Parallel: independent same-stage nodes run concurrently (max set to the right, working-dir-guarded). Click for sequential.':
    'Паралельно: незалежні вузли одного рівня виконуються одночасно (максимум — праворуч, із захистом робочої теки). Натисніть для послідовного режиму.',
  'Sequential: one node at a time (safe). Click to run independent nodes in parallel.':
    'Послідовно: по одному вузлу за раз (безпечно). Натисніть, щоб виконувати незалежні вузли паралельно.',
  'Max agents running at once (click to cycle 1–6). Lower to 1–2 if Claude returns 500 / ‘overloaded’ on big outputs.':
    'Максимум агентів одночасно (клік — цикл 1–6). Зменшіть до 1–2, якщо Claude повертає 500 / «overloaded» на великих відповідях.',
  Stop: 'Зупинити',
  'Stop the running graph': 'Зупинити виконання графа',
  'Run Graph': 'Запустити граф',
  'Run the whole graph in dependency order, iterating any loops until they pass or hit the cap.':
    'Запустити весь граф у порядку залежностей, повторюючи цикли, доки вони не пройдуть або не досягнуть межі.',
  'Save flow as:': 'Зберегти потік як:',
  'Remove from Palette': 'Прибрати з палітри',

  // ---- Palette ----
  'Expand palette': 'Розгорнути палітру',
  'Collapse palette': 'Згорнути палітру',
  'Custom Agent': 'Власний агент',
  'Create a freely-wireable custom agent — click to add, or drag onto the canvas.':
    'Створити вільно з’єднуваного власного агента — натисніть, щоб додати, або перетягніть на полотно.',
  'My Agents': 'Мої агенти',
  Nodes: 'Вузли',
  'Click to add, or drag onto the canvas. Save a configured Custom Agent (★ in its Properties panel) to reuse it here.':
    'Натисніть, щоб додати, або перетягніть на полотно. Збережіть налаштованого власного агента (★ у панелі властивостей), щоб використати його тут знову.',

  // ---- Node labels + descriptions (shown in palette / on canvas) ----
  Prompt: 'Промпт',
  'A sticky note — type your idea / prompt directly on it. The seed Forge turns into a prototype.':
    'Стікер — впишіть свою ідею / промпт прямо на ньому. Зерно, з якого Forge робить прототип.',
  'Info Card': 'Інформаційна картка',
  'Documentation card (forge produces this): title, abstract, contributions of the prototype.':
    'Картка документації (її створює forge): назва, анотація, внесок прототипу.',
  File: 'Файл',
  'Files & folders staged into an agent’s inputs/. Drag files straight from your desktop onto the canvas, drop onto this node to add more, or pick from the Library. Folders copy in recursively.':
    'Файли й теки, що додаються до inputs/ агента. Перетягуйте файли прямо з робочого столу на полотно, кидайте на цей вузол, щоб додати ще, або обирайте з Бібліотеки. Теки копіюються рекурсивно.',
  Forge: 'Forge',
  'Drafts a paper version + a machine-checkable results skeleton.':
    'Створює чернетку версії статті + машинно-перевірюваний каркас результатів.',
  Temper: 'Temper',
  'Verifies the skeleton algebraically + numerically; emits a structured verdict.':
    'Перевіряє каркас алгебраїчно + чисельно; видає структурований вердикт.',
  'Freely-wireable agent — name it, prompt it, pick a provider/model, tool scope, file inputs. Drops anywhere in a flow, including onto a loop. Can act as a loop Verifier.':
    'Вільно з’єднуваний агент — дайте йому назву, промпт, оберіть провайдера/модель, набір інструментів, вхідні файли. Ставиться будь-де в потоці, зокрема на цикл. Може бути Перевіряючим у циклі.',
  Body: 'Текст',
  'Writes the model/results exposition around the VERIFIED theorems (olehwrites).':
    'Пише виклад моделі/результатів навколо ПЕРЕВІРЕНИХ теорем (olehwrites).',
  Literature: 'Література',
  'Writes related work / lit review; consumes & emits .bib (olehwrites).':
    'Пише огляд літератури; приймає та видає .bib (olehwrites).',
  Assemble: 'Складання',
  'Stitches the verified theorems + written sections + bibliography into one compilable main.tex and runs latexmk → PDF. An agent node — pick any agentic provider (Claude Code / Codex / OpenRouter-agent).':
    'Зшиває перевірені теореми + написані розділи + бібліографію в один компільований main.tex і запускає latexmk → PDF. Агентний вузол — оберіть будь-якого агентного провайдера (Claude Code / Codex / OpenRouter-agent).',
  Warehouse: 'Склад',
  'Collects the graph’s results into an indexed pile that ACCUMULATES across runs. Wire it from ANY agent’s output; each run adds a new run-NNN folder.':
    'Збирає результати графа в індексовану купу, що НАКОПИЧУЄТЬСЯ між запусками. Під’єднуйте до виходу БУДЬ-ЯКОГО агента; кожен запуск додає нову теку run-NNN.',
  Glue: 'Склейка',
  'Deterministically stitch photos + videos into ONE mp4 with ffmpeg (no AI, no tokens). Wire photo/video sources into "media"; stills become short segments. Clip order = file name — prefix 01_/02_ to control it.':
    'Детерміновано зшиває фото + відео в ОДИН mp4 через ffmpeg (без ШІ, без токенів). Під’єднуйте джерела фото/відео до «media»; світлини стають короткими сегментами. Порядок кліпів = ім’я файлу — додайте префікс 01_/02_ для керування.',

  // ---- Help panel ----
  'How Forge works': 'Як працює Forge',
  'The idea in one line': 'Ідея одним рядком',
  'Drag nodes from the left, wire their ports, and run the graph. Each node is an agent or a piece of data; edges carry one node’s output into the next node’s input.':
    'Перетягуйте вузли зліва, з’єднуйте їхні порти та запускайте граф. Кожен вузол — це агент або дані; ребра переносять вихід одного вузла на вхід наступного.',
  'Port colors — what flows on an edge': 'Кольори портів — що тече ребром',
  'a raw idea / seed (from an Idea node)': 'сира ідея / зерно (з вузла ідеї)',
  'a Forge prototype (LaTeX + results skeleton)': 'прототип Forge (LaTeX + каркас результатів)',
  'a Temper verdict (the loop’s feedback)': 'вердикт Temper (зворотний зв’язок циклу)',
  'results that PASSED verification': 'результати, що ПРОЙШЛИ перевірку',
  'an Info Card (title / abstract / spec)': 'інформаційна картка (назва / анотація / специфікація)',
  'written prose (body / literature)': 'написаний текст (основа / література)',
  'a bibliography (.bib)': 'бібліографія (.bib)',
  'files & folders staged onto disk': 'файли й теки, викладені на диск',
  'universal — accepts/emits anything (Custom Agent, Warehouse)':
    'універсальний — приймає/видає будь-що (Власний агент, Склад)',
  'Ports only connect when types are compatible; an any port bridges anything.':
    'Порти з’єднуються лише за сумісних типів; порт «any» з’єднує будь-що.',
  'A Forge node’s inputs (context vs files vs idea)': 'Входи вузла Forge (контекст / файли / ідея)',
  'the required seed — your claim/mechanism in words. Injected as {{idea}}.':
    'обов’язкове зерно — ваше твердження/механізм словами. Підставляється як {{idea}}.',
  'files & folders (from a Files node). Copied to disk in the agent’s inputs/ folder; the agent opens them with Read. Use for PDFs, data, .bib, a draft.':
    'файли й теки (з вузла «Файл»). Копіюються на диск у теку inputs/ агента; агент відкриває їх через Read. Для PDF, даних, .bib, чернетки.',
  'text from any other node (another agent’s output, an Info Card, notes). Merged into the prompt as text — never a file. Use to “consider this too”.':
    'текст із будь-якого іншого вузла (вихід іншого агента, картка, нотатки). Додається до промпта як текст — ніколи як файл. Щоб «врахуй ще й це».',
  'the loop’s back-edge — Temper’s verdict, re-injected each iteration (see Loops).':
    'зворотне ребро циклу — вердикт Temper, що підставляється щоітерації (див. Цикли).',
  'Rule of thumb: a document → inputs (a file on disk); text/another node’s output → context (text in the prompt). Everything passes as text except inputs, which pass as real files.':
    'Правило: документ → inputs (файл на диску); текст/вихід іншого вузла → контекст (текст у промпті). Усе передається як текст, окрім inputs, що передаються як справжні файли.',
  'Loops — the arching arrow IS the loop': 'Цикли — вигнута стрілка І Є цикл',
  'Wire a node’s out back into an earlier node’s feedback port to form a loop (e.g. Temper → Forge). The rose “loop ≤N” arc means it really cycles — the source re-runs the target until it passes or hits the cap (click the arc to edit mode/cap; drag its handle to reposition).':
    'З’єднайте вихід «out» вузла назад із портом «feedback» ранішого вузла, щоб утворити цикл (напр. Temper → Forge). Рожева дуга «loop ≤N» означає, що цикл справді працює — джерело перезапускає ціль, доки вона не пройде або не досягне межі (клік по дузі — режим/межа; перетягніть маркер, щоб перемістити).',
  'An amber “⚠ not a loop” edge means there’s no forward path closing the cycle — so nothing iterates. Add a forward edge from the target back to the source (or delete the stray edge).':
    'Бурштинове ребро «⚠ not a loop» означає, що немає прямого шляху, який замикає цикл — тож нічого не повторюється. Додайте пряме ребро від цілі назад до джерела (або видаліть зайве ребро).',
  Running: 'Запуск',
  'walks the order & animates edges WITHOUT calling any agent — free, for sanity-checking wiring.':
    'проходить порядок і анімує ребра БЕЗ виклику агентів — безкоштовно, для перевірки з’єднань.',
  'actually executes every agent (spends tokens), iterating loops to convergence.':
    'справді виконує кожного агента (витрачає токени), повторюючи цикли до збіжності.',
  '▶ on a node': '▶ на вузлі',
  'runs just that node (and its upstream dependencies).': 'запускає лише цей вузол (і його висхідні залежності).',
  'Files in vs results out': 'Файли на вході / результати на виході',
  'your persistent input store — upload files/folders, then pick them in a Files node.':
    'ваше постійне сховище входів — завантажте файли/теки, потім оберіть їх у вузлі «Файл».',
  'wire it from ANY agent’s output; it collects artifacts (pdf/md/tex/all) from disk into an indexed pile that accumulates a new run-NNN each run.':
    'під’єднуйте до виходу БУДЬ-ЯКОГО агента; збирає артефакти (pdf/md/tex/усе) з диска в індексовану купу, що додає нову run-NNN щозапуску.',
  'Agents & effort': 'Агенти та зусилля',
  'Each agent picks a provider (only the ones you have are offered): Claude Code & Codex use your CLI subscription; Anthropic Harness & OpenRouter use an API key (Settings). Effort trades latency for depth (low→max). A Custom Agent is a blank agent — name it, prompt it, wire it anywhere, even onto the loop.':
    'Кожен агент обирає провайдера (пропонуються лише наявні у вас): Claude Code і Codex використовують вашу підписку CLI; Anthropic Harness і OpenRouter — API-ключ (Налаштування). «Зусилля» міняє швидкість на глибину (low→max). Власний агент — це порожній агент: дайте назву, промпт і з’єднайте будь-де, навіть на цикл.',
  'Got it': 'Зрозуміло',

  // ---- Settings ----
  Appearance: 'Вигляд',
  'App font': 'Шрифт застосунку',
  'Text size': 'Розмір тексту',
  'Applies instantly, saved in your browser. Toggle light/dark with the ☀/🌙 in the header.':
    'Застосовується миттєво, зберігається у браузері. Світлу/темну тему перемикайте ☀/🌙 угорі.',
  'Project folder': 'Тека проєкту',
  'Absolute path; persists across restarts.': 'Абсолютний шлях; зберігається між перезапусками.',
  Close: 'Закрити',
  'Browse…': 'Огляд…',
  Set: 'Задати',
  'Enter an absolute path.': 'Введіть абсолютний шлях.',
  '⬆ up': '⬆ вгору',
  '+ New folder': '+ Нова тека',
  '(no subfolders)': '(немає підтек)',
  '✓ Use this folder': '✓ Обрати цю теку',
  'New folder name (created inside the current folder):': 'Назва нової теки (створюється всередині поточної):',
  'Agent self-awareness': 'Самоусвідомлення агента',
  'Inject graph context into every agent': 'Додавати контекст графа до кожного агента',
  'Reset to default': 'Скинути до типового',
  'Save template': 'Зберегти шаблон',
  'Saving…': 'Збереження…',
  saved: 'збережено',
  'CLI paths': 'Шляхи до CLI',
  'Auto-detected by default (Claude Code on PATH; Codex from the IDE extension). Override only if yours live elsewhere.':
    'За замовчуванням визначаються автоматично (Claude Code у PATH; Codex із розширення IDE). Змінюйте, лише якщо ваші лежать деінде.',
  'Save CLI paths': 'Зберегти шляхи CLI',
  'Provider API keys': 'API-ключі провайдерів',
  'Save keys': 'Зберегти ключі',
  configured: 'налаштовано',
  'not set': 'не задано',

  // ---- Node chrome (on canvas) ----
  'Run this node': 'Запустити цей вузол',
  'Delete node': 'Видалити вузол',
  'Double-click to rename': 'Двічі клацніть, щоб перейменувати',
  'Double-click to change icon & color': 'Двічі клацніть, щоб змінити іконку та колір',
  'Custom color': 'Власний колір',
  untitled: 'без назви',
  'iter': 'ітер.',

  // ---- FileManager / common ----
  Library: 'Бібліотека',
  Cancel: 'Скасувати',
  Delete: 'Видалити',
  Rename: 'Перейменувати',
  Open: 'Відкрити',
  Add: 'Додати',
  Refresh: 'Оновити',
}
