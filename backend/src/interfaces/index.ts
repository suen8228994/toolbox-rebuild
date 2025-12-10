export interface TaskConfig {
  type: 'checklive' | 'register';
  platformClient: 'hubstudio' | 'roxybrowser';
  complicating: number;
  singleCount?: number;
  colorWaitTime?: number;
  sort?: string;
  arrange?: boolean;
  passwordRule?: string;
  bindAddress?: boolean;
  failedDeleteEnvironment?: boolean;
  status: 'running' | 'stopped';
}

export interface TaskLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: any;
}
