export type MockResult = { members: number; threads: number; comments: number; likes: number; listings: number; deals: number; pictures: number; skipped: string[] };
export function seedMock(query: (text: string, params?: unknown[]) => Promise<any[]>): Promise<MockResult>;
