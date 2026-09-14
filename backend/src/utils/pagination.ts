import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function paginate(query: unknown): Pagination {
  return paginationSchema.parse(query);
}

export function pageMeta(total: number, page: number, pageSize: number) {
  return { total, page, pageSize, hasMore: (page + 1) * pageSize < total };
}
