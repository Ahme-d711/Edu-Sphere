export class AppError extends Error {
  // 1. readonly: يمنع التعديل بعد الإنشاء
  readonly statusCode: number;
  
  // 2. نوع محدد: 'fail' أو 'error' فقط
  readonly status: 'fail' | 'error';
  
  // 3. ثابتة دائمًا = true
  readonly isOperational = true;

  // 4. قيمة افتراضية 500 + مدخل آمن
  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    
    // 5. تحديد أدق: 4xx → fail, غير ذلك → error
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';

    // 6. آمن: قد لا توجد في بعض البيئات
    Error.captureStackTrace?.(this, this.constructor);
  }

  // 7. مصانع (Factory Methods): استخدام أسرع وأوضح
  static badRequest(msg: string) {
    return new AppError(msg, 400);
  }

  static unauthorized(msg = 'Unauthorized') {
    return new AppError(msg, 401);
  }

  static forbidden(msg = 'Forbidden') {
    return new AppError(msg, 403);
  }

  static notFound(msg = 'Not found') {
    return new AppError(msg, 404);
  }
}