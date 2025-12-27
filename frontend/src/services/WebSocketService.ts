import { io, Socket } from 'socket.io-client';

interface JobUpdateData {
  jobId: string;
  status: string;
  data?: unknown;
  timestamp: string;
}

interface JobProgressData {
  jobId: string;
  status: string;
  progress: number;
  message?: string;
  timestamp: string;
}

interface JobCompletedData {
  jobId: string;
  status: string;
  result: {
    status: string;
    noteId: string;
    fileId: string;
    userId: string;
  };
  timestamp: string;
}

interface JobErrorData {
  jobId: string;
  status: string;
  error: string;
  timestamp: string;
}

export type JobEventData = JobUpdateData | JobProgressData | JobCompletedData | JobErrorData;

interface WebSocketEventHandlers {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onConnectionError?: (error: Error) => void;
  onJobUpdate?: (data: JobUpdateData) => void;
  onJobProgress?: (data: JobProgressData) => void;
  onJobCompleted?: (data: JobCompletedData) => void;
  onJobError?: (data: JobErrorData) => void;
}

interface ConnectionOptions {
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
  transports?: string[];
}

class WebSocketService {
  private socket: Socket | null = null;
  private isConnectedState: boolean = false;
  private eventHandlers: WebSocketEventHandlers = {};
  private isConnecting: boolean = false; // Prevent duplicate connections
  private subscriptions: Set<string> = new Set(); // Track active subscriptions
  private pendingSubscriptions: Set<string> = new Set(); // Track subscriptions to restore on reconnect

  /**
   * Initialize and connect to the WebSocket server
   */
  connect(options: ConnectionOptions = {}): Socket {
    // Prevent duplicate connections
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return this.socket;
    }

    if (this.isConnecting) {
      console.log('WebSocket connection already in progress');
      return this.socket!;
    }

    this.isConnecting = true;

    const defaultOptions: ConnectionOptions = {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      ...options,
    };

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    this.socket = io(`${apiUrl}/jobs`, defaultOptions);

    this.setupEventListeners();

    return this.socket;
  }

  /**
   * Setup internal event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket?.id);
      this.isConnectedState = true;
      this.isConnecting = false;
      
      // Auto-resubscribe to all pending subscriptions on reconnect
      if (this.pendingSubscriptions.size > 0) {
        console.log('Restoring', this.pendingSubscriptions.size, 'subscriptions after reconnect');
        this.pendingSubscriptions.forEach(subKey => {
          const params = JSON.parse(subKey);
          this.socket?.emit('subscribe:jobs', params);
          this.subscriptions.add(subKey);
          console.log('Restored subscription:', params);
        });
      }
      
      this.eventHandlers.onConnect?.();
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnectedState = false;
      this.isConnecting = false;
      this.eventHandlers.onDisconnect?.(reason);
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('WebSocket connection error:', error);
      this.isConnectedState = false;
      this.isConnecting = false;
      this.eventHandlers.onConnectionError?.(error);
    });

    this.socket.on('job:update', (data: JobUpdateData) => {
      console.log('Job update received:', data);
      this.eventHandlers.onJobUpdate?.(data);
    });

    this.socket.on('job:progress', (data: JobProgressData) => {
      console.log('Job progress:', data);
      this.eventHandlers.onJobProgress?.(data);
    });

    this.socket.on('job:completed', (data: JobCompletedData) => {
      console.log('[WebSocketService] job:completed event received:', data);
      console.log('[WebSocketService] Calling onJobCompleted handler');
      this.eventHandlers.onJobCompleted?.(data);
    });

    this.socket.on('job:error', (data: JobErrorData) => {
      console.error('Job error:', data);
      this.eventHandlers.onJobError?.(data);
    });
  }

  /**
   * Register event handlers
   */
  on(handlers: WebSocketEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Subscribe to job updates by userId or jobId
   */
  subscribeToJobs(params: { userId?: string; jobId?: string }): void {
    if (!this.socket?.connected) {
      console.warn('[WebSocketService] Cannot subscribe: WebSocket not connected, saving for reconnect');
      // Save subscription to restore on reconnect
      const subKey = JSON.stringify(params);
      this.pendingSubscriptions.add(subKey);
      return;
    }

    // Create subscription key to prevent duplicates
    const subKey = JSON.stringify(params);
    if (this.subscriptions.has(subKey)) {
      console.log('[WebSocketService] Already subscribed to:', params);
      return;
    }

    console.log('[WebSocketService] Emitting subscribe:jobs with params:', params);
    this.socket.emit('subscribe:jobs', params, (response: unknown) => {
      console.log('[WebSocketService] Subscription response:', response);
    });
    this.subscriptions.add(subKey);
    this.pendingSubscriptions.add(subKey); // Also add to pending for reconnect scenarios
    console.log('[WebSocketService] Subscribed to jobs:', params);
  }

  /**
   * Unsubscribe from job updates
   */
  unsubscribeFromJobs(params: { userId?: string; jobId?: string }): void {
    const subKey = JSON.stringify(params);
    this.subscriptions.delete(subKey);
    this.pendingSubscriptions.delete(subKey);

    if (this.socket?.connected) {
      this.socket.emit('unsubscribe:jobs', params);
      console.log('Unsubscribed from jobs:', params);
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      console.log('Disconnecting WebSocket...');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnectedState = false;
      this.isConnecting = false;
      this.eventHandlers = {};
      this.subscriptions.clear();
      this.pendingSubscriptions.clear();
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.isConnectedState && this.socket?.connected === true;
  }

  /**
   * Get the raw socket instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export a singleton instance
export const webSocketService = new WebSocketService();

export default webSocketService;
