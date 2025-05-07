import {type Dispatch, useCallback, useMemo, useState} from 'react'

const DEFAULT_TRIGGER = 'onChange'
const DEFAULT_VALUE_PROP_NAME = 'value'

export interface UseControlledOptions<T> {
  /**
   * @description - 非受控模式下的默认值,会被受控模式下的值覆盖
   * @description_en - Default value in uncontrolled mode, will be overridden by the value in controlled mode
   */
  defaultValue: T
  /**
   * @description - 值变更前的回调函数，可用于拦截或修改新值
   * @description_en - Callback function before the value changes, can be used to intercept or modify the new value
   */
  onBeforeChange?: (newValue: T, currentValue: T) => boolean | void
  /**
   * @description - 当值发生变化时触发的回调函数名
   * @description_en - Callback function name triggered when the value changes
   * @default - onChange
   */
  trigger?: string
  /**
   * @description - 值的属性名
   * @description_en - Property name of the value
   * @default - value
   */
  valuePropName?: string
  props: Record<string, any>
}

export function useControlled<T>(
  options: UseControlledOptions<T>,
): [T, Dispatch<React.SetStateAction<T>>] {
  const {
    defaultValue,
    onBeforeChange,
    trigger = DEFAULT_TRIGGER,
    valuePropName = DEFAULT_VALUE_PROP_NAME,
    props,
  } = options
  const isControlled = Object.prototype.hasOwnProperty.call(props, valuePropName)
  const [internalValue, setInternalValue] = useState<T>(defaultValue)
  const value = isControlled ? props[valuePropName] : internalValue
  const onChange = useMemo(() => props[trigger], [props, trigger])

  const setValue = useCallback<Dispatch<React.SetStateAction<T>>>(
    (newValue) => {
      const resolvedValue =
        typeof newValue === 'function' ? (newValue as (prev: T) => T)(value) : newValue
      if (onBeforeChange) {
        const shouldProceed = onBeforeChange(resolvedValue, value)
        if (shouldProceed === false) {
          return
        }
      }
      if (!isControlled) {
        setInternalValue(resolvedValue)
      }
      if (onChange) {
        onChange(resolvedValue)
      }
    },
    [isControlled, onBeforeChange, value, onChange],
  )

  return [value, setValue]
}
