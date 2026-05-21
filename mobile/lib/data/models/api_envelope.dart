/// Standard API response envelope (spec §2.4): `{data, error, pagination}`.
class ApiResponse<T> {
  const ApiResponse({required this.data, this.error, this.pagination});

  final T? data;
  final String? error;
  final Pagination? pagination;
}

class Pagination {
  const Pagination({required this.page, required this.pageSize, required this.total});
  final int page;
  final int pageSize;
  final int total;

  factory Pagination.fromJson(Map<String, dynamic> json) => Pagination(
        page: (json['page'] as num).toInt(),
        pageSize: (json['pageSize'] as num).toInt(),
        total: (json['total'] as num).toInt(),
      );
}
