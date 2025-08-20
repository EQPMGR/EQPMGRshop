
import { format } from 'date-fns';

// Firebase Timestamps can be objects. This safely converts them to JS Date.
export const toDate = (date: any): Date => {
  if (!date) return new Date();
  if (date.toDate) return date.toDate();
  return new Date(date);
};

export const toNullableDate = (date: any): Date | null => {
    if (!date) return null;
    if (date.toDate) return date.toDate();
    return new Date(date);
}

// Default date format, can be overridden by user preference
export const formatDate = (date?: Date, formatStr: string = 'PP'): string => {
    if (!date) return 'N/A';
    try {
        return format(toDate(date), formatStr);
    } catch (error) {
        console.error("Error formatting date:", date, error);
        return 'Invalid Date';
    }
}
