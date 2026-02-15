/**
 * Centralized dangerous SQL/Mongo patterns for validation and sanitization.
 * Used by both queryValidation and querySanitizer to ensure consistent behavior.
 */

export const DANGEROUS_SQL_PATTERNS: RegExp[] = [
  /;\s*drop\s+table/i,
  /;\s*drop\s+database/i,
  /;\s*truncate/i,
  /;\s*delete\s+from/i,
  /;\s*--/i,
  /--/i,
  /\/\*[\s\S]*?\*\//i,
  /\bALTER\s+(DATABASE|SCHEMA|TABLE|USER|ROLE)\b/i,
  /\bCREATE\s+(DATABASE|SCHEMA|USER|ROLE)\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bEXEC\s*\(/i,
  /\bEXECUTE\s*\(/i,
  /\bSP_\w+/i,
];

export const DANGEROUS_MONGO_PATTERNS: RegExp[] = [
  /\$where/i,
  /\$eval/i,
  /\$function/i,
  /db\.eval\(/i,
  /db\.runCommand\(/i,
  /\$regex.*\$where/i,
];
