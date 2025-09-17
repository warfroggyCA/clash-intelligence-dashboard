/**
 * Standardized API Client for Clash Intelligence Dashboard
 * 
 * This file provides a consistent interface for all API calls,
 * including error handling, request/response formatting, and retry logic.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import { ApiResponse } from '@/types';

// =============================================================================
// API CLIENT CONFIGURATION
// =============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// =============================================================================
// TYPES
// =============================================================================

interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: any;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

class ApiClientError extends Error implements ApiError {
  status?: number;
  code?: string;
  details?: any;

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a timeout promise that rejects after specified milliseconds
 */
const createTimeout = (ms: number): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
  });
};

/**
 * Delay execution for specified milliseconds
 */
const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Check if error is retryable
 */
const isRetryableError = (error: any): boolean => {
  // Network errors, timeouts, and 5xx errors are retryable
  return (
    !error.status || // Network error
    error.status >= 500 || // Server error
    error.status === 429 || // Rate limited
    error.message.includes('timeout') ||
    error.message.includes('network')
  );
};

/**
 * Build query string from parameters
 */
const buildQueryString = (params: Record<string, any>): string => {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(item => searchParams.append(key, String(item)));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });
  
  return searchParams.toString();
};

// =============================================================================
// API CLIENT CLASS
// =============================================================================

class ApiClient {
  private baseURL: string;
  private defaultOptions: RequestOptions;

  constructor(baseURL: string = API_BASE_URL, defaultOptions: RequestOptions = {}) {
    this.baseURL = baseURL;
    this.defaultOptions = {
      timeout: DEFAULT_TIMEOUT,
      retries: MAX_RETRIES,
      retryDelay: RETRY_DELAY,
      headers: {
        'Content-Type': 'application/json',
      },
      ...defaultOptions,
    };
  }

  /**
   * Make HTTP request with retry logic and error handling
   */
  private async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const config = { ...this.defaultOptions, ...options };
    const url = `${this.baseURL}${endpoint}`;
    
    let lastError: any;
    
    for (let attempt = 0; attempt <= (config.retries || 0); attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);
        
        const response = await fetch(url, {
          ...config,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new ApiClientError(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            errorData.code,
            errorData
          );
        }
        
        const data = await response.json();
        return data;
        
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on last attempt or non-retryable errors
        if (attempt === config.retries || !isRetryableError(error)) {
          break;
        }
        
        // Wait before retry
        await delay(config.retryDelay! * Math.pow(2, attempt)); // Exponential backoff
      }
    }
    
    throw lastError;
  }

  /**
   * GET request
   */
  async get<T = any>(
    endpoint: string,
    params?: Record<string, any>,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const queryString = params ? buildQueryString(params) : '';
    const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
    
    return this.request<T>(fullEndpoint, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(
    endpoint: string,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

class ApiEndpoints {
  constructor(private client: ApiClient) {}

  // Roster endpoints
  async getRoster(clanTag: string) {
    return this.client.get('/api/roster', { clanTag });
  }

  // Insights endpoints
  async generateCoachingInsights(clanTag: string, memberTag: string, clanData: any) {
    return this.client.post('/api/ai-coaching/generate', {
      clanTag,
      memberTag,
      clanData,
    });
  }

  async generateInsightsSummary(clanTag: string, changes: any[], clanData?: any) {
    return this.client.post('/api/ai-summary/generate', {
      type: 'full_analysis',
      clanData: {
        clanName: clanData?.clanName,
        clanTag: clanData?.clanTag || clanTag,
        memberCount: clanData?.memberCount,
        averageTownHall: clanData?.averageTownHall,
        averageTrophies: clanData?.averageTrophies,
        totalDonations: clanData?.totalDonations,
        roleDistribution: clanData?.roleDistribution,
        members: clanData?.members,
        snapshotMetadata: clanData?.snapshotMetadata,
        snapshotDetails: clanData?.snapshotDetails,
      }
    });
  }

  async getInsightsBundle(clanTag: string) {
    return this.client.get('/api/ai/batch-results', { clanTag });
  }

  // Discord endpoints
  async publishToDiscord(webhookUrl: string, data: any) {
    return this.client.post('/api/discord/publish', {
      webhookUrl,
      ...data,
    });
  }

  // Snapshot endpoints
  async createSnapshot(clanTag: string) {
    return this.client.post('/api/snapshots/create', { clanTag });
  }

  async getSnapshots(clanTag: string) {
    return this.client.get('/api/snapshots/list', { clanTag });
  }

  async getSnapshotChanges(clanTag: string) {
    return this.client.get('/api/snapshots/changes', { clanTag });
  }

  async markChangesAsRead(clanTag: string, date: string, createdAt?: string) {
    return this.client.post('/api/snapshots/changes', {
      clanTag,
      date,
      createdAt,
      action: 'mark_read',
    });
  }

  // Access management endpoints
  async getAccessList(clanTag: string) {
    return this.client.get('/api/access/list', { clanTag });
  }

  async initializeAccess(clanTag: string, clanName: string, ownerPassword: string) {
    return this.client.post('/api/access/init', {
      clanTag,
      clanName,
      ownerPassword,
    });
  }

  // Departure endpoints
  async getDepartures(clanTag: string) {
    return this.client.get('/api/departures', { clanTag });
  }

  async getDepartureNotifications(clanTag: string) {
    return this.client.get('/api/departures/notifications', { clanTag });
  }

  async recordDeparture(clanTag: string, data: any) {
    return this.client.post('/api/departures', {
      clanTag,
      ...data,
    });
  }

  // Player database endpoints
  async getPlayerDatabase() {
    return this.client.get('/api/player-db');
  }

  async syncDepartures(clanTag: string) {
    return this.client.post('/api/player-db/sync-departures', { clanTag });
  }

  // Tenure endpoints
  async getTenureMap(clanTag: string) {
    return this.client.get('/api/tenure/map', { clanTag });
  }

  async saveTenure(data: any) {
    return this.client.post('/api/tenure/save', data);
  }

  // Health check
  async healthCheck() {
    return this.client.get('/api/health');
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

// Create default client instance
const apiClient = new ApiClient();

// Create endpoints instance
export const api = new ApiEndpoints(apiClient);

// Export client for custom usage
export { ApiClient, ApiClientError };

// Export default client
export default apiClient;
