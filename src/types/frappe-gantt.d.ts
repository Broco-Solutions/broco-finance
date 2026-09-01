declare module "frappe-gantt" {
  export interface GanttTask {
    id: string;
    name: string;
    start: string;
    end: string;
    type?: string;
    progress?: number;
    dependencies?: string;
    custom_class?: string;
    description?: string;
    [key: string]: unknown;
  }

  export interface GanttOptions {
    view_mode?: string;
    view_mode_select?: boolean;
    readonly?: boolean;
    readonly_dates?: boolean;
    readonly_progress?: boolean;
    today_button?: boolean;
    infinite_padding?: boolean;
    language?: string;
    lines?: string;
    popup?: unknown;
    popup_on?: string;
    scroll_to?: string;
    [key: string]: unknown;
  }

  export default class Gantt {
    constructor(
      wrapper: HTMLElement | string,
      tasks: GanttTask[],
      options?: GanttOptions,
    );
    change_view_mode(mode?: string, maintainPos?: boolean): void;
    scroll_current(): void;
    refresh(tasks: GanttTask[]): void;
    update_options(options: GanttOptions): void;
    destroy(): void;
  }
}

declare module "frappe-gantt/dist/frappe-gantt.css";
