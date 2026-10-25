import { Counter } from '@/models/Counter';

export type CounterSequenceKey = 'enquiry' | 'booking' | 'receipt' | 'invoice' | 'ticket';

const PREFIX_MAP: Record<CounterSequenceKey, string> = {
  enquiry: 'ENQ',
  booking: 'BKG',
  receipt: 'REC',
  invoice: 'INV',
  ticket: 'TKT',
};

export async function nextCode(key: CounterSequenceKey, session?: any): Promise<string> {
  const result = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );

  const prefix = PREFIX_MAP[key];
  const number = 100000 + result.seq;
  return `${prefix}-${number}`;
}
