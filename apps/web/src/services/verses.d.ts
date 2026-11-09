export interface BibleVerse {
  provider: string
  translation: string
  externalId: string
  reference: string
  theme: string
  text: string
  copyright: string
}

export interface GetVerseParams {
  emotion: string
  translation?: string
}

export function getVerseForEmotion(params: GetVerseParams): Promise<BibleVerse>

export interface RecordVerseHistoryInput {
  provider: string
  externalId: string
  title?: string
  emotionRecordId?: string
}

export interface VerseHistoryEntry {
  id: string
  emotionRecordId: string | null
  provider: string
  externalId: string
  title: string | null
  createdAt: string
}

export function recordVerseHistory(
  input: RecordVerseHistoryInput,
): Promise<VerseHistoryEntry>
