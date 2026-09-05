export type TaskStatus = 'pending' | 'completed' | 'overdue';
export type TaskView = 'today' | 'all' | 'done';

export interface Task {
  id: string;
  title: string;
  deadline: string;
  status: TaskStatus;
  tags: string;
  show_floating: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParsedTask extends Task {
  tags_list: string[];
}

export interface TaskStoreState {
  tasks: ParsedTask[];
  loading: boolean;
  searchKeyword: string;
  currentView: TaskView;
}
