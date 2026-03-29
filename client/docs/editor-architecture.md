# Архитектура фронтенда

## Зачем это нужно

Сейчас проект уже вышел из стадии, где можно спокойно жить с папками вида:

- `api/`
- `models/`
- `stores/`
- `lib/`
- `composables/`

в отрыве от предметной области.

На практике это приводит к тому, что код одной сущности размазывается по всему `src`, а дальше становится тяжело понять:

- что относится к домену;
- что относится к presentation;
- что является общим shared-слоем;
- где лежит временный мок;
- где DTO, а где внутренняя модель приложения.

Наша цель:

- разделить код не только по техническим папкам, но и по ответственности;
- держать `components` вне доменов;
- не тащить UI-логику в domain-слой;
- сделать структуру, в которой по пути файла сразу понятно, что это за код.

## Базовая модель слоев

Мы фиксируем три верхнеуровневых слоя:

1. `domains/`
2. `presentation/` и `components/`
3. `shared/`

### 1. `domains/`

Это предметная логика.

Сюда относится все, что описывает сущность или подсистему:

- models;
- DTO;
- store;
- api;
- mappers;
- mocks;
- pure business helpers;
- правила и инварианты данных.

Важно:

- домен не равен компоненту;
- домен не должен знать про DOM;
- домен не должен знать про `MouseEvent`, `HTMLElement`, `ref` на canvas и прочую UI-механику.

### 2. `presentation/` и `components/`

Это presentation layer.

Сюда относится все, что отвечает за:

- композицию экрана;
- рендер;
- обработку DOM-событий;
- page-level orchestration;
- wiring между store/composables и шаблоном.

Важно:

- page-level composables тоже могут быть presentation;
- не каждый `composable` является доменом;
- не каждый `lib` является доменом.

Если код работает с:

- `MouseEvent`;
- `WheelEvent`;
- `HTMLElement`;
- `SVGElement`;
- canvas refs;
- router navigation;
- layout рендера;

то это почти наверняка presentation, а не domain.

### 3. `shared/`

Это общий слой, который не принадлежит конкретному домену и не является page presentation.

Сюда относятся:

- `presentation/ui`;
- `presentation/layouts`;
- базовый `http` клиент;
- очень общие composables вроде `useAsyncData`;
- общие типы/утилиты, если они реально не привязаны к одному домену.

## Главное правило

Код мы классифицируем не по имени папки и не по типу файла, а по ответственности.

### Это domain

- хранит business state;
- описывает сущности;
- меняет документ;
- сериализует и десериализует данные;
- инкапсулирует правила редактора;
- работает с transport contract;
- используется в нескольких presentation-местах как предметная логика.

### Это presentation

- связывает стор и шаблон;
- обрабатывает клики и drag;
- знает про canvas;
- знает про меню, панель, модалку, тулбар;
- обслуживает конкретную страницу;
- подготавливает данные для рендера.

### Это shared

- не привязано к одному домену;
- не является бизнес-логикой;
- не зависит от одной страницы;
- можно переиспользовать без знания предметной области.

## Что не считаем доменом

Не являются доменами:

- `FlowEditorWorkspace.vue`
- `GraphNode.vue`
- `GraphEdge.vue`
- `PropertiesPanel.vue`
- `TeamModal.vue`
- `SchemeCardItem.vue`
- page-level composables для drag/canvas/menu orchestration

Даже если внутри них много кода, это все равно presentation.

## Целевые домены проекта

На текущем этапе проект естественно делится на такие домены:

### 1. `schemes`

Сюда логично собрать:

- список схем;
- получение схемы;
- создание схемы;
- удаление схемы;
- модели `Scheme`, `SchemeCard`, `SchemeVersion`;
- DTO и mapper.

### 2. `editor-document`

Это основной домен редактора.

Сюда логично собрать:

- документ схемы;
- JSON DTO документа;
- store документа;
- правила построения/нормализации документа;
- сохранение версии;
- операции над узлами, ребрами, data flows и comments;
- document mocks.

### 3. `collaboration`

Сюда логично собрать:

- realtime API;
- SignalR clients;
- realtime events/types;
- store совместной работы;
- lock state;
- join/leave/connect/disconnect.

### 4. `graph`

Это базовый shared-domain или поддомен.

Сюда относятся:

- `Node`
- `Edge`
- `DataFlow`
- `ConnectionSide`
- geometry types

Этот кусок либо остается как отдельный shared domain, либо потом станет вложенной частью `editor-document`.

Пока можно оставить отдельно.

## Что сейчас уже есть в проекте

### Presentation

Это уже presentation и должно остаться вне доменов:

- `src/presentation/pages/schemes-list/*`
- `src/presentation/pages/flow-editor/*`
- `src/presentation/pages/flow-editor/components/*`
- `src/presentation/pages/flow-editor/composables/*`

Также presentation-композаблами сейчас являются:

- `src/presentation/pages/flow-editor/composables/useNodeDrag.ts`
- `src/presentation/pages/flow-editor/composables/useBreakpointDrag.ts`
- `src/presentation/pages/flow-editor/composables/useCommentDrag.ts`
- `src/presentation/pages/flow-editor/composables/useEditorDiagnostics.ts`
- `src/presentation/pages/flow-editor/composables/useFlowGraphView.ts`

Это не домен, потому что они обслуживают текущую страницу и ее визуальное поведение.

### Shared

Это уже shared и не должно переезжать в домены:

- `src/presentation/ui/*`
- `src/presentation/layouts/*`
- `src/shared/api/http.ts`
- `src/shared/composables/useAsyncData.ts`

### Domain-кандидаты

Это уже сейчас выглядит как материал для доменов:

- `src/api/schemes/*`
- `src/models/schemes/*`
- `src/composables/useScheme.ts`
- `src/composables/useSchemesList.ts`

- `src/api/editor-document/*`
- `src/models/editor/*`
- `src/stores/editorDocument.ts`
- `src/lib/editor/document/*`

- `src/api/realtime/*`
- `src/stores/editorCollaboration.ts`

- `src/models/graph/*`
- `src/lib/editor/graph/*`
- `src/lib/editor/layout/*`
- `src/lib/editor/validation/*`

### Пограничные места

Это места, где сейчас особенно легко ошибиться:

#### `src/lib/editor/*`

Не весь `lib/editor` одинаковый.

Нужно различать:

- pure document/business helpers;
- graph/layout/validation rules;
- presentation-facing helpers.

Если helper знает только про данные документа, это domain.

Если helper знает про DOM, canvas или страницу, это presentation.

#### `src/composables/*`

Не все composables нужно переносить в домены.

Например:

- `useAsyncData` это shared;
- `useSchemesList` ближе к domain-facing composable;
- `useNodeDrag` это presentation;
- `useFlowEditorRoute` это presentation;
- `useFlowEditorComments` сейчас presentation-controller над editor domain.

## Целевая структура

Ниже не финальный вид на один день, а направление миграции.

```text
src/
  domains/
    schemes/
      api/
      models/
      mappers/
      composables/
      mocks/
    editor-document/
      api/
      models/
      store/
      lib/
      mocks/
    collaboration/
      api/
      models/
      store/
    graph/
      models/
      lib/

  presentation/
    pages/
      schemes-list/
        index.vue
        components/
        composables/
      flow-editor/
        index.vue
        components/
        composables/
        store/

  components/
    ui/
    layouts/

  shared/
    api/
    composables/
    lib/
```

## Как это маппится на текущие папки

### Будущий `domains/schemes`

Сюда по смыслу должны уйти:

- `src/api/schemes/*`
- `src/models/schemes/*`
- `src/composables/useScheme.ts`
- `src/composables/useSchemesList.ts`

### Будущий `domains/editor-document`

Сюда по смыслу должны уйти:

- `src/api/editor-document/*`
- `src/models/editor/*`
- `src/stores/editorDocument.ts`
- `src/lib/editor/document/*`

Часть `layout/validation/graph` тоже, скорее всего, относится сюда, но переносить их нужно уже после дополнительной сортировки.

### Будущий `domains/collaboration`

Сюда по смыслу должны уйти:

- `src/api/realtime/*`
- `src/stores/editorCollaboration.ts`

### Будущий `domains/graph`

Сюда по смыслу должны уйти:

- `src/models/graph/*`
- часть `src/lib/editor/graph/*`
- часть `src/lib/editor/layout/*`
- часть `src/lib/editor/validation/*`

Но этот перенос не стоит делать первым, потому что тут выше риск ошибиться с границей между pure graph logic и editor-specific rules.

### Что остается в presentation

Остается в presentation:

- все `presentation/pages/*`
- все page-level `components/*`
- все page-level composables под `presentation/pages/flow-editor/composables`
- глобальные drag/view composables, пока они завязаны на страницу и DOM

## Порядок миграции

Чтобы не взорвать проект, идем маленькими партиями.

### Партия 1. Зафиксировать архитектурные правила

Это текущий шаг.

Результат:

- понятно, что считаем доменом;
- понятно, что presentation не уезжает в домены;
- понятно, что `composables` и `lib` могут относиться к разным слоям.

### Партия 2. Начать с самых очевидных доменов

Первыми кандидатами на физический перенос:

- `schemes`
- `editor-document`

Потому что у них уже есть:

- models;
- api;
- store или composables;
- четкая предметная граница.

### Партия 3. Разобрать `graph`

После этого уже разделять:

- что в `graph` является общим;
- что в `editor-document` является документной бизнес-логикой;
- что вообще не domain, а presentation helper.

### Партия 4. Разобрать `shared`

Отдельно собрать:

- shared composables;
- shared lib;
- shared api utilities.

## Что делаем дальше практически

Следующий технический шаг лучше делать не по всему проекту сразу, а по одному домену.

Лучший кандидат:

### `schemes`

Почему:

- маленький и понятный;
- уже почти собран;
- не тянет за собой тяжёлый editor;
- можно быстро проверить жизнеспособность новой структуры.

После этого уже переносить:

### `editor-document`

Но там делать отдельными партиями:

- `models`
- `api`
- `store`
- `lib`
- `mocks`

## Короткие правила на каждый день

Чтобы дальше держать структуру чистой:

1. Компоненты не являются доменом.
2. Page-level composables чаще всего presentation.
3. DTO живут рядом с доменом, а не в общем хаосе.
4. Моки должны лежать рядом с тем, что они подменяют.
5. Store должен хранить состояние и сценарии, а не превращаться в склад типов и pure helpers.
6. Если код знает про DOM, это почти всегда не domain.
7. Если код описывает сущность, инварианты и операции над ней, это domain.

## Статус

На текущий момент архитектурно уже сделано полезное:

- домен `schemes` уже физически перенесен в `src/domains/schemes`;
- `schemes` теперь хранит рядом:
  - `api/`
  - `models/`
  - `mappers/`
  - `composables/`
- presentation-слой больше не импортирует `schemes` из старых `src/api` и `src/composables`;
- домен `editor-document` уже получил свой каркас в `src/domains/editor-document`;
- в `editor-document` уже физически перенесены:
  - `models/`
  - `api/`
- `editorDocument` store уже физически перенесен в `src/domains/editor-document/store`;
- document-specific helpers уже физически перенесены в `src/domains/editor-document/lib`;
- layout-helpers, которые обслуживают структуру документа и parent/child поведение, уже перенесены в `src/domains/editor-document/lib`;
- graph-helpers, которые обслуживают pass-through и построение связей документа, уже перенесены в `src/domains/editor-document/lib`;
- validation-helpers, которые обслуживают диагностику и проверку документа, уже перенесены в `src/domains/editor-document/lib`;
- `updateVersion` API уже перенесен в `src/domains/editor-document/api`;
- домен `collaboration` уже физически создан в `src/domains/collaboration`;
- realtime API и `editorCollaboration` store уже перенесены в `src/domains/collaboration`;
- collaboration transport-типы уже разложены по одному файлу на тип в `src/domains/collaboration/api/types`;
- `editorUi` уже вынесен из общего `stores` и живет как presentation-store в `src/presentation/pages/flow-editor/store`;
- `graph`-модели уже физически перенесены в `src/domains/graph/models`;
- route pages уже физически перенесены в `src/presentation/pages`;
- `flow-editor` page-owned components, composables и store уже живут в `src/presentation/pages/flow-editor`;
- `schemes-list` page-owned components и `CreateSchemeModal` уже живут в `src/presentation/pages/schemes-list`;
- editor-specific типы больше не живут в старых `src/models/editor`;
- DTO документа больше не живут в старых `src/api/editor-document`;
- старый `src/lib/editor/document` больше не используется;
- старый `src/lib/editor/layout` больше не используется;
- старый `src/lib/editor/graph` больше не используется;
- старый `src/lib/editor/validation` больше не используется;
- старый `src/api/realtime` больше не используется;
- старый `src/stores/editorCollaboration.ts` больше не используется;
- старая папка `src/models/graph` больше не используется;
- `flow-editor` выделен как presentation-страница;
- page-only components лежат рядом со страницей;
- editor types начали выноситься из store;
- mocks стали явнее;
- часть pure helpers уже вынесена из `editorDocument`.

Следующий шаг после этого документа:

- продолжить физический перенос следующего домена в `src/domains`.

Следующий лучший кандидат:

- `editor-document/store`

Следующая маленькая партия внутри `editor-document`:

- смотреть, что из `lib/editor/layout`, `graph`, `validation` относится к `editor-document`, а что к отдельному `graph` domain;
- смотреть, что из `lib/editor/graph` и `lib/editor/validation` относится к `editor-document`, а что к отдельному `graph` domain;
- потом тем же способом перенести `editorCollaboration`.

Следующий лучший кандидат:

- дочистить корневой `src/models` и `src/stores` до роли временных compatibility-barrel
