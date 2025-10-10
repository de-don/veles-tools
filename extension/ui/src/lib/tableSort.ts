import type { SortOrder } from 'antd/es/table/interface';

export interface SortDescriptor {
  field: string;
  order: Exclude<SortOrder, null>;
}

const ASC_TOKEN: Exclude<SortOrder, null> = 'ascend';
const DESC_TOKEN: Exclude<SortOrder, null> = 'descend';

export const parseSortDescriptor = (input: string | null | undefined): SortDescriptor | null => {
  if (!input) {
    return null;
  }

  const [rawField, rawDirection] = input.split(',');
  const field = rawField?.trim();
  const direction = rawDirection?.trim().toLowerCase();

  if (!field || !direction) {
    return null;
  }

  if (direction === 'asc') {
    return { field, order: ASC_TOKEN };
  }

  if (direction === 'desc') {
    return { field, order: DESC_TOKEN };
  }

  return null;
};

export const serializeSortDescriptor = ({ field, order }: SortDescriptor): string => {
  const normalizedField = field.trim();
  const token = order === ASC_TOKEN ? 'asc' : 'desc';
  return `${normalizedField},${token}`;
};
