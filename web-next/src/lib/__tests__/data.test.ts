import { readLedgerEffective } from '../data';
import { promises as fsp } from 'fs';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    stat: jest.fn(),
  },
}));

// Mock config
jest.mock('../config', () => ({
  cfg: {
    dataRoot: 'data'
  }
}));

const mockFsp = fsp as jest.Mocked<typeof fsp>;

describe('readLedgerEffective', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty object when file does not exist', async () => {
    // Mock fsp.stat to throw error (file doesn't exist)
    mockFsp.stat.mockRejectedValue(new Error('File not found'));
    
    const result = await readLedgerEffective();
    
    expect(result).toEqual({});
  });

  it('should parse valid ledger entries', async () => {
    const mockLedgerContent = `{"tag":"#2PR8R8V8P","base":100,"ts":"2024-01-01T00:00:00Z","as_of":"2024-01-01"}`;
    
    // Mock file exists and content
    mockFsp.stat.mockResolvedValue({} as any);
    mockFsp.readFile.mockResolvedValue(mockLedgerContent);
    
    const result = await readLedgerEffective();
    
    // Should return the base values plus days since as_of date
    expect(result).toHaveProperty('#2PR8R8V8P');
    expect(typeof result['#2PR8R8V8P']).toBe('number');
    expect(result['#2PR8R8V8P']).toBeGreaterThan(100);
  });

  it('should use latest timestamp for duplicate tags', async () => {
    const mockLedgerContent = `{"tag":"#2PR8R8V8P","base":100,"ts":"2024-01-01T00:00:00Z","as_of":"2024-01-01"}
{"tag":"#2PR8R8V8P","base":200,"ts":"2024-01-02T00:00:00Z","as_of":"2024-01-02"}`;
    
    mockFsp.stat.mockResolvedValue({} as any);
    mockFsp.readFile.mockResolvedValue(mockLedgerContent);
    
    const result = await readLedgerEffective();
    
    // Should use the later entry (base: 200)
    expect(result['#2PR8R8V8P']).toBeGreaterThan(200);
  });

  it('should handle tenure_days field as fallback', async () => {
    const mockLedgerContent = `{"tag":"#2PR8R8V8P","tenure_days":150,"ts":"2024-01-01T00:00:00Z","as_of":"2024-01-01"}`;
    
    mockFsp.stat.mockResolvedValue({} as any);
    mockFsp.readFile.mockResolvedValue(mockLedgerContent);
    
    const result = await readLedgerEffective();
    
    expect(result['#2PR8R8V8P']).toBeGreaterThan(150);
  });

  it('should skip invalid entries', async () => {
    const mockLedgerContent = `{"tag":"#2PR8R8V8P","base":100,"ts":"2024-01-01T00:00:00Z","as_of":"2024-01-01"}
{"tag":"INVALID","base":50,"ts":"2024-01-02T00:00:00Z","as_of":"2024-01-02"}
{"tag":"#9G2R8V8P","base":75,"ts":"2024-01-03T00:00:00Z","as_of":"2024-01-03"}`;
    
    mockFsp.stat.mockResolvedValue({} as any);
    mockFsp.readFile.mockResolvedValue(mockLedgerContent);
    
    const result = await readLedgerEffective();
    
    expect(result).toHaveProperty('#2PR8R8V8P');
    expect(result).toHaveProperty('#9G2R8V8P');
    expect(result).not.toHaveProperty('INVALID');
  });

  it('should skip entries without valid base or tenure_days', async () => {
    const mockLedgerContent = `{"tag":"#2PR8R8V8P","base":100,"ts":"2024-01-01T00:00:00Z","as_of":"2024-01-01"}
{"tag":"#9G2R8V8P","ts":"2024-01-02T00:00:00Z","as_of":"2024-01-02"}
{"tag":"#8L2R8V8P","base":"invalid","ts":"2024-01-03T00:00:00Z","as_of":"2024-01-03"}`;
    
    mockFsp.stat.mockResolvedValue({} as any);
    mockFsp.readFile.mockResolvedValue(mockLedgerContent);
    
    const result = await readLedgerEffective();
    
    expect(result).toHaveProperty('#2PR8R8V8P');
    expect(result).not.toHaveProperty('#9G2R8V8P');
    expect(result).not.toHaveProperty('#8L2R8V8P');
  });

  it('should handle malformed JSON lines', async () => {
    const mockLedgerContent = `{"tag":"#2PR8R8V8P","base":100,"ts":"2024-01-01T00:00:00Z","as_of":"2024-01-01"}
invalid json line
{"tag":"#9G2R8V8P","base":200,"ts":"2024-01-02T00:00:00Z","as_of":"2024-01-02"}`;
    
    mockFsp.stat.mockResolvedValue({} as any);
    mockFsp.readFile.mockResolvedValue(mockLedgerContent);
    
    const result = await readLedgerEffective();
    
    expect(result).toHaveProperty('#2PR8R8V8P');
    expect(result).toHaveProperty('#9G2R8V8P');
  });

  it('should handle empty lines and whitespace', async () => {
    const mockLedgerContent = `{"tag":"#2PR8R8V8P","base":100,"ts":"2024-01-01T00:00:00Z","as_of":"2024-01-01"}

{"tag":"#9G2R8V8P","base":200,"ts":"2024-01-02T00:00:00Z","as_of":"2024-01-02"}
   `;
    
    mockFsp.stat.mockResolvedValue({} as any);
    mockFsp.readFile.mockResolvedValue(mockLedgerContent);
    
    const result = await readLedgerEffective();
    
    expect(result).toHaveProperty('#2PR8R8V8P');
    expect(result).toHaveProperty('#9G2R8V8P');
  });

  it('should normalize tag case to uppercase', async () => {
    const mockLedgerContent = `{"tag":"#2pr8r8v8p","base":100,"ts":"2024-01-01T00:00:00Z","as_of":"2024-01-01"}`;
    
    mockFsp.stat.mockResolvedValue({} as any);
    mockFsp.readFile.mockResolvedValue(mockLedgerContent);
    
    const result = await readLedgerEffective();
    
    expect(result).toHaveProperty('#2PR8R8V8P');
  });

  it('should return non-negative values', async () => {
    const mockLedgerContent = `{"tag":"#2PR8R8V8P","base":-50,"ts":"2024-01-01T00:00:00Z","as_of":"2024-01-01"}`;
    
    mockFsp.stat.mockResolvedValue({} as any);
    mockFsp.readFile.mockResolvedValue(mockLedgerContent);
    
    const result = await readLedgerEffective();
    
    expect(result['#2PR8R8V8P']).toBeGreaterThanOrEqual(0);
  });
});