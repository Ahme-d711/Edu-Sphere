/**
 * Filter object to allow only specific fields
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const filterObj = <T extends Record<string, any>, K extends keyof T>(
  obj: T,
  ...allowedFields: K[]
): Pick<T, K> => {
  const result = {} as Pick<T, K>;

  for (const key of allowedFields) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }

  return result;
};