"use client";

import { useState } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete";

type Props = {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  clearLabel?: string;
  clearMessage?: string;
};

/** Textarea có nút Xóa nội dung (ConfirmDelete countdown 5s). */
export function ClearableTextarea({
  name,
  label,
  defaultValue = "",
  required,
  placeholder,
  className = "textarea",
  clearLabel = "Xóa nội dung",
  clearMessage,
}: Props) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label mb-0">{label}</span>
        {value.trim() ? (
          <ConfirmDelete
            label={clearLabel}
            className="btn btn-secondary text-xs text-red-700"
            message={
              clearMessage ||
              `Xóa toàn bộ nội dung ô “${label}”? Có thể gõ hoặc dán lại sau.`
            }
            onConfirm={() => setValue("")}
          />
        ) : null}
      </div>
      <textarea
        name={name}
        className={className}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}
