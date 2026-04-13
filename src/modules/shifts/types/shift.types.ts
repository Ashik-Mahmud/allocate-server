export interface ClipboardShift {
  id: string;
  workerId: string;
  startTime: string; // ISO String
  endTime: string;   // ISO String
  hourlyRate: number;
  status: 'COMPLETED' | 'CANCELLED' | 'PENDING';
}