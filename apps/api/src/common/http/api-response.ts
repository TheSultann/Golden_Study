export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface PaginatedResponse<T, TMeta> extends SuccessResponse<T> {
  meta: TMeta;
}

export function successResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
  };
}

export function paginatedResponse<T, TMeta>(
  data: T,
  meta: TMeta,
): PaginatedResponse<T, TMeta> {
  return {
    success: true,
    data,
    meta,
  };
}
