import { Injectable } from '@nestjs/common';
import { fork, ChildProcess } from 'child_process';
import { join } from 'path';
import { Socket } from 'socket.io';

interface TaskConfig {
  status: 'running' | 'stop' | 'paused';
  platformClient: 'hubstudio' | 'roxybrowser';
  colorWaitTime: number;
  singleCount: number;
  complicating: number;
  arrange: boolean;
  sort: 'top-bottom' | 'bottom-top';
  args: string[];
  gapTime: number;
  autoSite: boolean;
  type: 'checklive' | 'register';
  passwordRule: string;
  failedDeleteEnvironment: boolean;
  bindAddress: boolean;
  group?: string;
}

@Injectable()
export class TaskSchedulerService {
  private socket: Socket | null = null;
  private progressList: any[] = [];
  private workers = new Map<string, ChildProcess>();
  private environmentBase = {
    options: {
      current: 1,
      max: 0,
      frequency: 0,
    },
    data: [],
  };

  private schedulerConfig: TaskConfig = {
    status: 'stop',
    platformClient: 'hubstudio',
    colorWaitTime: 150000,
    singleCount: 6,
    complicating: 4,
    arrange: true,
    sort: 'top-bottom',
    args: [],
    gapTime: 10800000,
    autoSite: false,
    type: 'checklive',
    passwordRule: 'email-password',
    failedDeleteEnvironment: false,
    bindAddress: false,
  };

  private browserManager: any;
  private requestPipe: any;

  async scheduler(props: Partial<TaskConfig>, socket: Socket) {
    this.socket = socket;
    this.schedulerConfig = {
      ...this.schedulerConfig,
      ...props,
    };

    // Initialize browser manager based on platform
    switch (this.schedulerConfig.platformClient) {
      case 'hubstudio':
        // this.browserManager = new HubstudioManager();
        console.log('HubStudio manager initialized');
        break;
      case 'roxybrowser':
        console.log('RoxyBrowser manager initialized');
        break;
    }

    this.setRunState('running');

    this.socket.on('task.config', (config) => {
      this.schedulerConfig = {
        ...this.schedulerConfig,
        ...config,
      };
      if (config.status === 'stop') {
        this.socket.emit('backend.task.runState', config.status);
      }
    });

    this.processNextTask();
  }

  private async processNextTask() {
    if (this.progressList.length === 0 && this.schedulerConfig.status === 'stop') {
      console.log('所有任务完成');
      return;
    }

    if (
      this.schedulerConfig.status !== 'running' ||
      this.progressList.length >= this.schedulerConfig.complicating
    ) {
      return;
    }

    if (this.schedulerConfig.type === 'checklive') {
      if (this.environmentBase.data.length === 0) {
        await this.availableEnvironments();
        if (this.environmentBase.data.length === 0) {
          this.setRunState('stop');
          return;
        }
      }
      await this.checkLive();
    } else {
      await this.register();
    }
  }

  private async checkLive() {
    const envItem = this.environmentBase.data.shift();
    const { containerCode } = envItem;
    const { args, colorWaitTime, arrange, type, singleCount } = this.schedulerConfig;

    this.progressList.push({
      containerCode,
      initRemark: false,
    });

    // Browser start logic would go here
    const startInfo = {
      debuggerAddress: 'localhost:9222',
      debuggerUrl: 'ws://localhost:9222',
    };

    this.execute(containerCode, {
      type,
      common: {
        ...envItem,
        ...startInfo,
      },
      checklive: {
        colorWaitTime,
        singleCount,
      },
    });
  }

  private async register() {
    const result = await this.resourceRegisterInfoDetails();
    if (!result) {
      this.setRunState('stop');
      return;
    }

    const { use, id, ...proxyinfo } = result;
    const { args, arrange, type, bindAddress } = this.schedulerConfig;

    // Create environment logic would go here
    const containerCode = 'TEST_' + Date.now();
    const serial = 'US-' + new Date().toISOString().slice(2, 10).replace(/-/g, '');

    this.progressList.push({ containerCode });

    const startInfo = {
      debuggerAddress: 'localhost:9222',
      debuggerUrl: 'ws://localhost:9222',
    };

    this.execute(containerCode, {
      type,
      common: {
        containerCode,
        serial,
        remark: '',
        countryCode: 'us',
        ...startInfo,
      },
      register: {
        bindAddress,
      },
    });
  }

  private async execute(id: string, data: any) {
    const workerPath = join(__dirname, '../../resources', 'task.worker.js');
    const child = fork(workerPath);
    this.workers.set(id, child);

    child.send({
      type: 'start',
      data,
    });

    child.on('message', (msg: any) => {
      switch (msg.type) {
        case 'tasklogs':
          this.queuedMessageSender(msg.taskLogs);
          break;
        case 'taskstatus':
          this.queuedTaskStatus(msg.taskStatus);
          break;
        case 'requestcard':
          this.queuedRequestCard(msg.id);
          break;
        case 'requestemail':
          this.queuedRequestEmail(msg.id);
          break;
        case 'requestphone':
          this.queuedRequestPhone(msg.id);
          break;
      }
    });

    child.on('exit', () => {
      this.workers.delete(id);
    });
  }

  private setRunState(state: 'running' | 'stop' | 'paused') {
    this.schedulerConfig.status = state;
    this.socket?.emit('backend.task.runState', state);
  }

  private queuedMessageSender(msg: any) {
    const { remark, containerCode, message, logID, serial } = msg;
    this.socket?.emit('run.task.log', msg);

    switch (logID) {
      case 'Error-Info':
        console.error(`[${serial}] ${message}`);
        break;
      case 'CL-Start':
      case 'RG-Start':
      case 'RG-Info-Operate':
        console.log(`[${serial}] ${message}`);
        break;
      case 'CL-End':
      case 'RG-End':
        console.log(`[${serial}] ${message}`);
        break;
    }
  }

  private queuedTaskStatus(msg: any) {
    const { containerCode, currentStatus } = msg;

    switch (currentStatus) {
      case 'progress':
        this.processNextTask();
        break;
      case 'complete':
        const index = this.progressList.findIndex((item) => item.containerCode === containerCode);
        if (index !== -1) {
          this.progressList.splice(index, 1);
        }
        this.processNextTask();
        break;
    }
  }

  private async availableEnvironments() {
    // Mock implementation - would connect to actual browser manager
    this.environmentBase.data.push({
      containerCode: 'ENV_' + Date.now(),
      serial: 'TEST_001',
      remark: 'Test environment',
    });
  }

  private async queuedRequestCard(id: string) {
    const info = await this.resourceCardInfoDetails();
    const child = this.workers.get(id);
    if (child && !child.killed) {
      child.send({ type: 'card', data: info });
    }
  }

  private async queuedRequestEmail(id: string) {
    const info = await this.resourceEmailInfoDetails();
    const child = this.workers.get(id);
    if (child && !child.killed) {
      child.send({ type: 'email', data: info });
    }
  }

  private async queuedRequestPhone(id: string) {
    const info = await this.resourcePhoneInfoDetails();
    const child = this.workers.get(id);
    if (child && !child.killed) {
      child.send({ type: 'phone', data: info });
    }
  }

  private resourceCardInfoDetails(): Promise<any> {
    return new Promise((resolve) => {
      this.socket?.once('response.card.info', (data) => {
        resolve(data);
      });
      this.socket?.emit('request.card.info');
    });
  }

  private resourceEmailInfoDetails(): Promise<any> {
    return new Promise((resolve) => {
      this.socket?.once('response.email.info', (data) => {
        resolve(data);
      });
      this.socket?.emit('request.email.info');
    });
  }

  private resourcePhoneInfoDetails(): Promise<any> {
    return new Promise((resolve) => {
      this.socket?.once('response.phone.info', (data) => {
        resolve(data);
      });
      this.socket?.emit('request.phone.info');
    });
  }

  private resourceRegisterInfoDetails(): Promise<any> {
    return new Promise((resolve) => {
      this.socket?.once('response.proxy.info', (data) => {
        resolve(data);
      });
      this.socket?.emit('request.proxy.info');
    });
  }
}
