/**
 * Enhanced WebSocket Service (Optimized Version)
 * 
 * A singleton service for managing WebSocket connections with the backend.
 * Implements best practices for connection management, subscription handling,
 * and event routing.
 * 
 * Key Features:
 * - Singleton pattern (one connection per client)
 * - Automatic reconnection with exponential backoff
 * - Subscription deduplication and restoration on reconnect
 * - Type-safe event handling with standardized DTOs
 * - Connection state tracking
 * - Comprehensive logging for debugging
 * 
 * Usage:
 * ```typescript
 * import { webSocketService } from '@/services/WebSocketService';
 * 
 * // Connect (idempotent - safe to call multiple times)
 * webSocketService.connect();
 * 
 * // Register event handlers
 * webSocketService.on({
 *   onConnect: () => console.log('Connected'),
 *   onJobProgress: (data) => console.log('Progress:', data.progress),
 *   onJobCompleted: (data) => console.log('Completed:', data.result),
 * });
 * 
 * // Subscribe to user's jobs
 * webSocketService.subscribe({ userId: 'user-123' });
 * 
 * // Subscribe to specific job
 * webSocketService.subscribe({ jobId: 'job-456' });
 * 
 * // Unsubscribe when done
 * webSocketService.unsubscribe({ userId: 'user-123' });
 * ```
 */

import { io, Socket } from 'socket.io-client';
import type {
  JobProgressPayload,
  JobCompletedPayload,
  JobFailedPayload,
} from '@/types/job-events';

/**
 * Event handlers for WebSocket events
 */
interface WebSocketEventHandlers {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onConnectionError?: (error: Error) => void;
  onJobProgress?: (data: JobProgressPayload) => void;
  onJobCompleted?: (data: JobCompletedPayload) => void;
  onJobFailed?: (data: JobFailedPayload) => void;
}

/**
 * Connection configuration options
 */
interface ConnectionOptions {
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
  transports?: string[];
}

/**
 * Subscription parameters
 */
interface SubscriptionParams {
  userId?: string;
  jobId?: string;
}

/**
 * WebSocketService Class
 * 
 * Manages WebSocket connection lifecycle and event routing.
 * Implements singleton pattern to ensure one connection per client.
 */
class WebSocketService {
  private static instance: WebSocketService;
  private socket: Socket | null = null;
  private isConnectedState = false;
  private isConnecting = false;
  private eventHandlers: WebSocketEventHandlers = {};
  private subscriptions = new Set<string>();
  private pendingSubscriptions = new Set<string>();

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    console.log('[WS] WebSocketService instance created');
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Connect to the WebSocket server
   * 
   * Idempotent - safe to call multiple times.
   * Returns immediately if already connected or connecting.
   * 
   * @param options - Connection configuration options
   * @returns Socket instance
   */
  connect(options: ConnectionOptions = {}): Socket {
    // Prevent duplicate connections
    if (this.socket?.connected) {
      console.log('[WS] Already connected');
      return this.socket;
    }

    if (this.isConnecting) {
      console.log('[WS] Connection already in progress');
      return this.socket!;
    }

    this.isConnecting = true;
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    console.log('[WS] Initiating connection to', apiUrl);

    const defaultOptions: ConnectionOptions = {
      transports: ['websocket'], // Prefer WebSocket over polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity, // Keep trying
      ...options,
    };

    this.socket = io(`${apiUrl}/jobs`, defaultOptions);
    this.setupEventListeners();

    return this.socket;
  }

  /**
   * Setup internal Socket.IO event listeners
   * Handles connection lifecycle and job events
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection established
    this.socket.on('connect', () => {
      console.log('[WS] Connected. Socket ID:', this.socket?.id);
      this.isConnectedState = true;
      this.isConnecting = false;

      // Restore subscriptions after reconnect
      if (this.pendingSubscriptions.size > 0) {
        console.log(
          '[WS] Restoring',
          this.pendingSubscriptions.size,
          'subscriptions after reconnect',
        );
        this.pendingSubscriptions.forEach((subKey) => {
          const params = JSON.parse(subKey) as SubscriptionParams;
          this.socket?.emit('subscribe:jobs', params);
          this.subscriptions.add(subKey);
          console.log('[WS] Restored subscription:', params);
        });
      }

      this.eventHandlers.onConnect?.();
    });

    // Connection lost
    this.socket.on('disconnect', (reason: string) => {
      console.log('[WS] Disconnected. Reason:', reason);
      this.isConnectedState = false;
      this.isConnecting = false;
      this.eventHandlers.onDisconnect?.(reason);
    });

    // Connection error
    this.socket.on('connect_error', (error: Error) => {
      console.error('[WS] Connection error:', error.message);
      this.isConnectedState = false;
      this.isConnecting = false;
      this.eventHandlers.onConnectionError?.(error);
    });

    // Job progress update
    this.socket.on('job:progress', (data: JobProgressPayload) => {
      console.log('[WS] Job progress:', {
        jobId: data.jobId,
        stage: data.stage,
        progress: data.progress,
      });
      this.eventHandlers.onJobProgress?.(data);
    });

    // Job completed
    this.socket.on('job:completed', (data: JobCompletedPayload) => {
      console.log('[WS] Job completed:', {
        jobId: data.jobId,
        noteId: data.result?.noteId,
        processingTime: data.result?.processingTimeMs,
      });
      this.eventHandlers.onJobCompleted?.(data);
    });

    // Job failed
    this.socket.on('job:error', (data: JobFailedPayload) => {
      console.error('[WS] Job failed:', {
        jobId: data.jobId,
        error: data.error?.message,
      });
      this.eventHandlers.onJobFailed?.(data);
    });
  }

  /**
   * Register event handlers
   * 
   * Event handlers are merged, not replaced.
   * Call this method multiple times to add different handlers.
   * 
   * @param handlers - Event handler callbacks
   */
  on(handlers: WebSocketEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
    console.log('[WS] Event handlers registered');
  }

  /**
   * Subscribe to job updates
   * 
   * Can subscribe by userId (all jobs for user) or jobId (specific job).
   * Deduplicates subscriptions automatically.
   * Queues subscriptions if not connected (restored on reconnect).
   * 
   * @param params - Subscription parameters (userId or jobId)
   */
  subscribe(params: SubscriptionParams): void {
    const subKey = JSON.stringify(params);

    // Prevent duplicate subscriptions
    if (this.subscriptions.has(subKey)) {
      console.log('[WS] Already subscribed to:', params);
      return;
    }

    // If not connected, queue subscription for later
    if (!this.socket?.connected) {
      console.log('[WS] Not connected. Queuing subscription:', params);
      this.pendingSubscriptions.add(subKey);
      return;
    }

    // Subscribe now
    console.log('[WS] Subscribing to:', params);
    this.socket.emit('subscribe:jobs', params, (response: unknown) => {
      const res = response as { success?: boolean; room?: string };
      if (res?.success) {
        console.log('[WS] Subscription confirmed:', res.room);
      }
    });

    this.subscriptions.add(subKey);
    this.pendingSubscriptions.add(subKey); // Also add to pending for reconnect
  }

  /**
   * Unsubscribe from job updates
   * 
   * Removes subscription from both active and pending sets.
   * 
   * @param params - Subscription parameters to remove
   */
  unsubscribe(params: SubscriptionParams): void {
    const subKey = JSON.stringify(params);
    this.subscriptions.delete(subKey);
    this.pendingSubscriptions.delete(subKey);

    if (this.socket?.connected) {
      console.log('[WS] Unsubscribing from:', params);
      this.socket.emit('unsubscribe:jobs', params);
    }
  }

  /**
   * Check if currently connected to WebSocket server
   * 
   * @returns True if connected, false otherwise
   */
  isConnected(): boolean {
    return this.isConnectedState && this.socket?.connected === true;
  }

  /**
   * Disconnect from WebSocket server
   * 
   * Cleans up all state and closes the connection.
   * Use sparingly - typically only on app shutdown or user logout.
   */
  disconnect(): void {
    if (this.socket) {
      console.log('[WS] Disconnecting...');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnectedState = false;
      this.isConnecting = false;
      this.eventHandlers = {};
      this.subscriptions.clear();
      this.pendingSubscriptions.clear();
      console.log('[WS] Disconnected and cleaned up');
    }
  }

  /**
   * Get the underlying Socket.IO instance
   * 
   * Use with caution - prefer using the service methods.
   * 
   * @returns Socket instance or null if not connected
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Get current subscription count
   * Useful for debugging
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get pending subscription count
   * Useful for debugging reconnection issues
   */
  getPendingSubscriptionCount(): number {
    return this.pendingSubscriptions.size;
  }
}

/**
 * Export singleton instance as default export
 */
export const webSocketService = WebSocketService.getInstance();

/**
 * Also export the class for type definitions
 */
export default WebSocketService;
