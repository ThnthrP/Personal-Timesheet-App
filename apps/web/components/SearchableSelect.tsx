'use client';

import Select from 'react-select';

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  /** id คงที่ต่อ instance — กัน hydration warning ของ react-select */
  instanceId: string;
  inputId?: string;
  ariaLabel?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** ขนาดเล็กสำหรับใช้ในแถวของตาราง (แบบ .ts-compact ใน prototype) */
  compact?: boolean;
  isDisabled?: boolean;
}

/**
 * Dropdown แบบพิมพ์ค้นหาได้ — แทน Tom Select ของ prototype
 * รายการเมนูถูกวางที่ <body> (menuPortalTarget) เหมือน dropdownParent: 'body'
 * เพื่อไม่ให้ถูกตัดขอบเมื่ออยู่ในตารางที่ scroll ได้
 */
export function SearchableSelect({
  instanceId,
  inputId,
  ariaLabel,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  compact = false,
  isDisabled = false,
}: SearchableSelectProps) {
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <Select<SelectOption, false>
      instanceId={instanceId}
      inputId={inputId}
      aria-label={ariaLabel}
      options={options}
      value={selected}
      onChange={(opt) => onChange(opt?.value ?? '')}
      placeholder={placeholder}
      isDisabled={isDisabled}
      noOptionsMessage={() => 'No matches'}
      unstyled
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPlacement="auto"
      styles={{
        menuPortal: (base) => ({ ...base, zIndex: 50 }),
        // รายการที่เด้งลงมากว้างตามข้อความ (อย่างน้อยเท่าช่อง ไม่เกิน 28rem) — ชื่อ + Employee ID จะไม่ตกบรรทัด
        // ช่องในตารางยังแคบเท่าเดิม คอลัมน์อื่นไม่ถูกเบียด
        menu: (base) => ({
          ...base,
          width: 'max-content',
          minWidth: '100%',
          maxWidth: 'min(28rem, calc(100vw - 2rem))',
        }),
      }}
      classNames={{
        control: ({ isFocused, isDisabled: disabled }) =>
          [
            'bg-white border transition-shadow',
            compact ? 'rounded-md px-2 py-1 text-sm min-h-0' : 'rounded-lg px-4 py-2',
            isFocused ? 'border-secondary ring-2 ring-secondary/35' : 'border-slate-300',
            disabled ? 'bg-slate-50 text-slate-400' : '',
          ].join(' '),
        placeholder: () => 'text-slate-400',
        singleValue: () => 'text-slate-800',
        input: () => 'text-slate-800',
        dropdownIndicator: () => 'text-slate-400 pl-2',
        indicatorSeparator: () => 'hidden',
        menu: () =>
          `mt-1 bg-white border border-slate-300 rounded-lg shadow-[0_8px_20px_rgba(0,0,0,0.12)] overflow-hidden ${
            compact ? 'text-sm' : ''
          }`,
        menuList: () => 'max-h-64 py-1',
        option: ({ isFocused, isSelected }) =>
          `px-3 py-2 cursor-pointer ${
            isSelected
              ? 'bg-blue-100 text-primary font-medium'
              : isFocused
                ? 'bg-blue-50 text-primary'
                : 'text-slate-700'
          }`,
        noOptionsMessage: () => 'px-3 py-2 text-slate-400',
      }}
    />
  );
}
