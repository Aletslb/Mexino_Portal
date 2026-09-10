export interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  BUCKET?: R2Bucket;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  ADVISOR_EMAILS?: string;
}
