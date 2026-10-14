'use client';
import { cloneElement, type ReactElement, useId } from 'react';

/** One native input/select/textarea; preserve a caller-provided ID. */
export function FormField({
  label,
  children,
  className,
  required = false,
  error,
}: {
  label: string;
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;
  className?: string;
  required?: boolean;
  error?: string;
}) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  return (
    <label className={['ui-form-field', className].filter(Boolean).join(' ')} htmlFor={id}>
      <span className="ui-form-label">
        {label}
        {required && (
          <span className="ui-field-required" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </span>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? `${id}-error` : children.props['aria-describedby'],
      })}
      {error && (
        <span id={`${id}-error`} className="ui-field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
