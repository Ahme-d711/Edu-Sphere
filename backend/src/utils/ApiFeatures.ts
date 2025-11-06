import type { Query, Document, FilterQuery } from 'mongoose';

interface QueryParams {
  page?: string | number;
  limit?: string | number;
  sort?: string;
  fields?: string;
  search?: string;

  // السماح بالمزيد من المرونة
  [key: string]:
    | string
    | number
    | boolean
    | string[]
    | number[]
    | boolean[]
    | {
        $in?: (string | number | boolean)[];
        $gte?: string | number;
        $gt?: string | number;
        $lte?: string | number;
        $lt?: string | number;
        $ne?: string | number;
      }
    | undefined;
}


interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

class ApiFeatures<T extends Document> {
  private query: Query<T[], T>;
  private queryParams: QueryParams;
  private originalQuery: Query<T[], T>;

  constructor(query: Query<T[], T>, queryParams: QueryParams) {
    this.originalQuery = query.clone();
    this.query = query;
    this.queryParams = queryParams;
  }

  filter() {
    const queryObj = { ...this.queryParams };
    const excluded = ['page', 'limit', 'sort', 'fields', 'search'] as const;
    excluded.forEach((field) => delete queryObj[field]);

    // Advanced filtering: { price[gte]: 100 } → { price: { $gte: 100 } }
    const queryStr = JSON.stringify(queryObj).replace(
      /\b(gte|gt|lte|lt|ne|in)\b/g,
      (match) => `$${match}`
    );

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }
  

  search(fields: (keyof T)[] = []) {
    if (this.queryParams.search && fields.length > 0) {
      const searchRegex = new RegExp(this.queryParams.search as string, 'i');

      // ✅ بدون any: نستخدم FilterQuery<T>
      const orConditions: FilterQuery<T>[] = fields.map(
        (field) => ({ [field]: searchRegex } as FilterQuery<T>)
      );

      this.query = this.query.find({ $or: orConditions } as FilterQuery<T>);
    }
    return this;
  }

  sort() {
    if (this.queryParams.sort) {
      const sortBy = (this.queryParams.sort as string)
        .split(',')
        .join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  select() {
    if (this.queryParams.fields) {
      const fields = (this.queryParams.fields as string)
        .split(',')
        .join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    const page = Math.max(Number(this.queryParams.page) || 1, 1);
    const limit = Math.min(Math.max(Number(this.queryParams.limit) || 9, 1), 100);
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }

  async execute(): Promise<{
    results: T[];
    pagination: PaginationResult;
  }> {
    // 1. تنفيذ الاستعلام الرئيسي
    const results = await this.query;

    // 2. حساب الإجمالي (باستخدام الاستعلام الأصلي قبل skip/limit)
    const filter = this.originalQuery.getFilter();
    const total = await this.originalQuery.model.countDocuments(filter);

    const page = Math.max(Number(this.queryParams.page) || 1, 1);
    const limit = Math.min(Math.max(Number(this.queryParams.limit) || 9, 1), 100);
    const pages = Math.ceil(total / limit);

    return {
      results,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
      },
    };
  }
}

export default ApiFeatures;