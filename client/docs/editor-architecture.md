# Архитектура редактора

## Зачем это нужно

Сейчас редактор перегружен логикой.
Одна страница одновременно:

- управляет route lifecycle;
- работает со store;
- содержит canvas-логику;
- содержит геометрию и валидацию графа;
- содержит realtime lifecycle;
- содержит логику меню, модалок и toolbar;
- содержит export-логику.

Такой код тяжело читать, тестировать и чинить.

Наша цель:

- в компонентах оставить декларативный код;
- сложную внутреннюю логику спрятать за простыми методами;
- разделить систему на маленькие части с понятной ответственностью;
- рефакторить маленькими партиями.

## Базовый принцип

Компонент должен отвечать за:

- композицию UI;
- проброс props/emits;
- вызов коротких понятных методов.

Компонент не должен быть местом, где живет сложная бизнес-логика.

Сложная логика должна жить в одном из слоев:

1. `stores/`
   Для состояния, orchestration и сценариев.

2. `lib/` или `domain/`
   Для чистых функций, вычислений, геометрии, правил, валидации.

3. `api/`
   Для сетевых вызовов и realtime-клиентов.

## Текущие зоны ответственности

### 1. `pages/flow-editor/index.vue`

Должен стать container-компонентом.

В нем должно остаться только:

- связывание UI-компонентов;
- подписка на route;
- вызов store actions;
- небольшие DOM-обработчики, если они реально завязаны на DOM.

### 2. `editorDocument`

Это источник истины для документа.

Здесь должно жить:

- `nodes`, `edges`, `dataFlows`, `comments`;
- загрузка/сохранение схемы;
- применение JSON;
- применение remote changes;
- document-level actions.

### 3. `editorUi`

Здесь должно жить:

- selection;
- режимы редактора;
- zoom;
- меню и модалки;
- transient UI state.

### 4. `editorCollaboration`

Здесь должно жить:

- подключение к hub;
- join/leave;
- lock state;
- обработка входящих realtime событий;
- вызов document-store при remote updates.

### 5. `lib/editor/*`

Сюда должна уйти чистая логика, не завязанная на Vue и DOM:

- построение сегментов ребра;
- pass-through расчеты;
- валидация данных;
- вычисление payload;
- вспомогательные функции графа.

## Что сейчас болит сильнее всего

Самая тяжелая проблема не в шаблоне, а в том, что presentation-слой редактора все еще может быстро разрастаться, если не держать его тонким.

Это логика вида:

- `buildNodeSendableData`
- `evaluatePassThroughStatus`
- `evaluateDataIntegrity`
- `calculatePassThroughOffsets`
- `getEdgeSegments`
- `doesEdgePassThroughNode`
- `isHorizontalPassThroughEdge`
- `isVerticalPassThroughEdge`

Это хороший кандидат на первый маленький вынос.

Почему именно с этого стоит начать:

- эти функции почти не зависят от Vue;
- их можно переносить партиями;
- после выноса страница станет заметно чище;
- ошибки станет проще локализовать;
- появится возможность отдельно тестировать вычисления.

## План маленькими партиями

### Партия 1. Вынести чистую геометрию и графовые вычисления

Создать папку примерно такого вида:

`src/lib/editor/graph/`

И начать переносить туда:

- `getEdgeSegments`
- `getNodeRect`
- `collectBoundaryHits`
- `doesEdgePassThroughNode`
- `isHorizontalPassThroughEdge`
- `isVerticalPassThroughEdge`
- `getPassThroughFraction`
- `calculatePassThroughOffsets`

Правило партии:

- переносим только чистые функции;
- не меняем поведение;
- не смешиваем это с UI-рефакторингом.

Результат партии:

- route-container становится меньше;
- тяжелая математика перестает жить в компоненте;
- ее можно отлаживать отдельно.

### Партия 2. Вынести валидацию документа

Следом вынести:

- `buildNodeSendableData`
- `evaluatePassThroughStatus`
- `evaluateDataIntegrity`
- `isDataReachable`

Пример папки:

`src/lib/editor/validation/`

### Партия 3. Вынести toolbar/menu/modal UI из страницы

Только после того, как системная логика будет спрятана, выносить визуальные куски:

- `EditorToolbar`
- `EditorVersionMenu`
- `EditorDownloadMenu`
- `TeamModal`

Иначе мы просто размажем сложную логику по нескольким компонентам.

## Правила рефакторинга

Чтобы не поломать все заново, придерживаемся таких правил:

1. Одна партия = одна понятная цель.
2. Не переносим одновременно и вычисления, и UI, и realtime.
3. Сначала выносим pure functions.
4. Потом выносим orchestration.
5. Потом разбиваем UI-компоненты.
6. После каждой партии обязательно проверяем типизацию.

## Что делаем следующим шагом

Следующий практический шаг:

создаем `src/lib/editor/graph/` и переносим туда первую группу pure-функций геометрии.

Это будет первая маленькая и безопасная партия.

## Статус

### Уже вынесено

В `src/lib/editor/graph/` уже вынесены:

- построение ортогональных сегментов ребра;
- определение horizontal/vertical pass-through;
- расчет pass-through offsets;
- расчет fraction для pass-through;
- проверка пересечения ребра с границами блока.

То есть первая партия уже начата.

В `src/lib/editor/validation/` уже вынесены:

- расчет `edgeRequiresPassThrough`;
- расчет `nodeSendableData`;
- проверка `nodeMissingTarget`;
- проверка целостности доставки данных;
- проверка pass-through статусов для узлов и ребер.

То есть второй системный кусок тоже начал отделяться от страницы.

В `src/lib/editor/layout/` уже вынесены:

- `roundCoord`;
- расчет root position после detach;
- расчет connection position;
- расчет connection point;
- `clampX/clampY` для breakpoint;
- recursive helpers для дерева узлов;
- helpers для parent sizing;
- helpers для child count и border style;
- helper поиска потенциального родителя по центру.

То есть layout-слой тоже начал оформляться отдельно.

Часть orchestration уже начала уезжать в `editorDocument`:

- `moveNodeToParent`
- `ensureParentPadding`
- `maintainPassThroughEdges`
- `refreshParentBorders`
- доступ к hierarchy helpers через store
- решение сценария после drag-drop (`finalizeNodeDrag`)
- поиск потенциального родителя через store

Это важный сдвиг: страница начинает не только импортировать pure-functions, но и делегировать document-level действия в store.

Часть drag orchestration уже вынесена в composables:

- `useNodeDrag`
- `useCommentDrag`
- `useBreakpointDrag`
- `useEditorDiagnostics`
- `useFlowGraphView`

То есть страница уже перестает держать длинный сценарий `mousedown -> mousemove -> mouseup` внутри себя.
И следом оттуда начали уезжать связанные вычислительные блоки:

- диагностика узлов и ребер;
- сбор `nodeErrorMessages/nodeWarningMessages`;
- сбор `edgeErrorMessages/edgeWarningMessages`;
- graph-view helpers для сегментов, connection positions, anchor и child count.

Часть page-level UI уже вынесена в route-specific components:

- `EditorToolbar`
- `TeamModal`
- `FlowEditorCodePane`
- `FlowEditorWorkspace`

То есть route-level контейнер в `pages/flow-editor/index.vue` уже больше не является гигантским orchestrator-файлом.
Сейчас он уже больше похож на `schemes-list`:

- контейнер читает route lifecycle;
- визуальные куски страницы вынесены в локальные page-components рядом.

`FlowEditorWorkspace` теперь стал store-aware page-component:

- он сам читает editor stores;
- сам подключает page-level composables;
- не получает больше десятки `props/emits` от route-page;
- держит только workspace/presentation orchestration.

Отдельно зафиксирован принцип для `pages/flow-editor/components`:

- page-only компоненты не лежат в общем `src/components`;
- если у page-component есть свои внутренние компоненты, они лежат рядом с ним в его собственной папке;
- глубже этого уровня не уходим, чтобы не получить лишнюю матрешку папок.

### Следующий маленький шаг

Следом стоит вынести оставшиеся связанные pure-функции из той же области, чтобы закрыть блок геометрии целиком.

Кандидаты на следующий шаг:

- продолжить убирать DOM-orchestration из страницы;
- посмотреть на canvas/right-panel декомпозицию;
- вынести zoom-controls или canvas shell в отдельный page-component;
- оценить, что из route-level orchestration уже можно вынести в editor-controller слой.

Отдельный кандидат после этого:

- выделить editor-controller слой поверх store/composables.

Идея:

- оставить в странице только доступ к DOM и store;
- расчеты координат и сегментов постепенно собрать в `lib/editor/graph`.
