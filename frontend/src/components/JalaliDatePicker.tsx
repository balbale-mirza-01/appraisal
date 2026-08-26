import DatePicker from "react-multi-date-picker";
import type DateObject from "react-date-object";
import gregorian from "react-date-object/calendars/gregorian";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

interface JalaliDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  required?: boolean;
}

function toIsoDate(date: DateObject | null) {
  if (!date?.isValid) return "";
  return date.convert(gregorian).format("YYYY-MM-DD");
}

export function JalaliDatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  required,
}: JalaliDatePickerProps) {
  return (
    <DatePicker
      calendar={persian}
      locale={persian_fa}
      value={value || undefined}
      format="YYYY/MM/DD"
      inputClass="jalali-date-input"
      containerClassName="jalali-date-container"
      calendarPosition="bottom-right"
      editable={false}
      onChange={(date) => onChange(toIsoDate(date))}
      minDate={minDate ? new Date(`${minDate}T00:00:00`) : undefined}
      maxDate={maxDate ? new Date(`${maxDate}T00:00:00`) : undefined}
      required={required}
    />
  );
}
