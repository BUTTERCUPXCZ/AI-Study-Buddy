import { Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as http from 'http';
import * as https from 'https';

type HttpAgent = http.Agent | https.Agent;

/**
 * Connection Pool Utility for Optimized Resource Management
 *
 * Reuses connections and resources to reduce overhead and improve performance.
 * Implements pooling for Supabase clients, HTTP connections, and other resources.
 */
export class ConnectionPoolUtil {
  private static readonly logger = new Logger('ConnectionPoolUtil');
  private static supabasePool: Map<string, SupabaseClient> = new Map();
  private static httpAgents: Map<string, HttpAgent> = new Map();

  /**
   * Get or create a Supabase client from pool
   * Reusing clients reduces initialization overhead
   */
  static getSupabaseClient(url: string, key: string): SupabaseClient {
    const poolKey = `${url}:${key}`;

    if (!this.supabasePool.has(poolKey)) {
      this.logger.debug('Creating new Supabase client');
      const client = createClient(url, key, {
        auth: {
          persistSession: false, // No session storage for workers
          autoRefreshToken: false,
        },
        global: {
          fetch: this.createOptimizedFetch(),
        },
      });
      this.supabasePool.set(poolKey, client);
    }

    return this.supabasePool.get(poolKey)!;
  }

  /**
   * Create optimized fetch with connection pooling
   */
  private static createOptimizedFetch() {
    // Create HTTP agents with connection pooling
    const httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 60000,
    });

    const httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 60000,
    });

    return (url: string, options: RequestInit = {}) => {
      const parsedUrl = new URL(url);
      const agent = parsedUrl.protocol === 'https:' ? httpsAgent : httpAgent;

      return fetch(url, {
        ...options,
        // @ts-expect-error - agent is valid for node environment
        agent,
      });
    };
  }

  /**
   * Get or create HTTP agent for connection pooling
   */
  static getHttpAgent(protocol: 'http' | 'https' = 'https'): HttpAgent {
    if (!this.httpAgents.has(protocol)) {
      const Agent = protocol === 'https' ? https.Agent : http.Agent;

      const agent = new Agent({
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets: 100, // High limit for concurrent downloads
        maxFreeSockets: 20,
        timeout: 120000, // 2 minute timeout
        scheduling: 'fifo',
      });

      this.httpAgents.set(protocol, agent);
      this.logger.debug(`Created ${protocol.toUpperCase()} agent`);
    }

    return this.httpAgents.get(protocol)!;
  }

  /**
   * Optimized fetch with connection pooling
   */
  static async optimizedFetch(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const protocol = url.startsWith('https') ? 'https' : 'http';
    const agent = this.getHttpAgent(protocol);

    return fetch(url, {
      ...options,
      // @ts-expect-error - agent is valid for node environment
      agent,
    });
  }

  /**
   * Download file with connection pooling and streaming
   */
  static async downloadFile(
    url: string,
    options: {
      timeout?: number;
      maxRetries?: number;
      onProgress?: (downloaded: number, total: number) => void;
    } = {},
  ): Promise<Buffer> {
    const { timeout = 120000, maxRetries = 3, onProgress } = options;
    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.optimizedFetch(url, {
          signal: AbortSignal.timeout(timeout),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentLength = parseInt(
          response.headers.get('content-length') || '0',
        );
        const chunks: Buffer[] = [];
        let downloaded = 0;

        // Stream the response for better memory efficiency
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(Buffer.from(value));
          downloaded += value.length;

          if (onProgress && contentLength > 0) {
            onProgress(downloaded, contentLength);
          }
        }

        return Buffer.concat(chunks);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Download attempt ${attempt + 1} failed: ${lastError.message}`,
        );

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt)),
          );
        }
      }
    }

    throw lastError!;
  }

  /**
   * Clear all connection pools (cleanup on shutdown)
   */
  static clearPools(): void {
    this.supabasePool.clear();
    this.httpAgents.clear();
    this.logger.log('Connection pools cleared');
  }

  /**
   * Get pool statistics
   */
  static getPoolStats() {
    return {
      supabaseClients: this.supabasePool.size,
      httpAgents: this.httpAgents.size,
    };
  }
}

/**
 * Resource Pool Manager for generic resource pooling
 */
export class ResourcePool<T> {
  private readonly logger = new Logger('ResourcePool');
  private available: T[] = [];
  private inUse = new Set<T>();
  private readonly factory: () => Promise<T>;
  private readonly destroyer?: (resource: T) => Promise<void>;
  private readonly maxSize: number;
  private readonly minSize: number;

  constructor(options: {
    factory: () => Promise<T>;
    destroyer?: (resource: T) => Promise<void>;
    maxSize?: number;
    minSize?: number;
  }) {
    this.factory = options.factory;
    this.destroyer = options.destroyer;
    this.maxSize = options.maxSize || 10;
    this.minSize = options.minSize || 2;
  }

  /**
   * Initialize pool with minimum resources
   */
  async initialize(): Promise<void> {
    for (let i = 0; i < this.minSize; i++) {
      const resource = await this.factory();
      this.available.push(resource);
    }
    this.logger.log(`Pool initialized with ${this.minSize} resources`);
  }

  /**
   * Acquire resource from pool
   */
  async acquire(): Promise<T> {
    // Try to get available resource
    if (this.available.length > 0) {
      const resource = this.available.pop()!;
      this.inUse.add(resource);
      return resource;
    }

    // Create new resource if under max size
    if (this.inUse.size < this.maxSize) {
      const resource = await this.factory();
      this.inUse.add(resource);
      return resource;
    }

    // Wait for resource to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.available.length > 0) {
          clearInterval(checkInterval);
          const resource = this.available.pop()!;
          this.inUse.add(resource);
          resolve(resource);
        }
      }, 100);
    });
  }

  /**
   * Release resource back to pool
   */
  async release(resource: T): Promise<void> {
    this.inUse.delete(resource);

    // Keep pool size reasonable
    if (this.available.length < this.maxSize) {
      this.available.push(resource);
    } else if (this.destroyer) {
      await this.destroyer(resource);
    }
  }

  /**
   * Execute function with pooled resource
   */
  async use<R>(fn: (resource: T) => Promise<R>): Promise<R> {
    const resource = await this.acquire();
    try {
      return await fn(resource);
    } finally {
      await this.release(resource);
    }
  }

  /**
   * Drain pool and destroy all resources
   */
  async drain(): Promise<void> {
    if (this.destroyer) {
      for (const resource of this.available) {
        await this.destroyer(resource);
      }
      for (const resource of this.inUse) {
        await this.destroyer(resource);
      }
    }

    this.available = [];
    this.inUse.clear();
    this.logger.log('Pool drained');
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
      maxSize: this.maxSize,
      minSize: this.minSize,
    };
  }
}
