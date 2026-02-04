const readPositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const DEFAULT_QUERY_TIMEOUT_MS = readPositiveInt(process.env.QUERY_TIMEOUT_MS, 30_000);

export const DEFAULT_QUERY_LIMIT = readPositiveInt(process.env.QUERY_DEFAULT_LIMIT, 1000);

export const MONGO_SCHEMA_SAMPLE_SIZE = readPositiveInt(process.env.MONGO_SCHEMA_SAMPLE_SIZE, 100);
