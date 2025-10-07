export interface ApiKeyConstraint {
  position: boolean;
  limit: number | null;
  long: number | null;
  short: number | null;
}

export interface ApiKey {
  id: number;
  name: string;
  exchange: string;
  accessKey: string;
  secretKey: string;
  constraint: ApiKeyConstraint | null;
}

export interface ApiKeysListResponse {
  totalElements: number;
  totalPages: number;
  pageNumber: number;
  content: ApiKey[];
}

export interface ApiKeysListParams {
  page?: number;
  size?: number;
}
