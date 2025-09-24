// ==== 基础规则类型 ====
export type BaseRule<TAll, TValue> = {
  required?: boolean;
  message?: string;
  validator?: (value: TValue, data: Partial<TAll>) => boolean | string;
  dependsOn?: (data: Partial<TAll>) => boolean | string; // 支持依赖校验
};

// ==== 长度相关规则（字符串和数组共用） ====
export type LengthRuleProps = {
  min?: number;
  max?: number;
  len?: number;
};

// ==== 数字范围规则 ====
export type NumberRangeProps = {
  min?: number;
  max?: number;
};

// ==== 字符串特有规则 ====
export type StringSpecificProps = {
  regex?: RegExp;
  email?: boolean;
  url?: boolean;
  phone?: boolean;
};

// ==== 数组特有规则 ====
export type ArraySpecificProps = {
  unique?: boolean;
};

// ==== 各类型规则 ====
export type NumberRule<TAll> = BaseRule<TAll, number> & NumberRangeProps;

export type StringRule<TAll> = BaseRule<TAll, string> &
  LengthRuleProps &
  StringSpecificProps;

export type BooleanRule<TAll> = BaseRule<TAll, boolean>;

export type ArrayRule<TAll, U> = BaseRule<TAll, U[]> &
  LengthRuleProps &
  ArraySpecificProps & {
    elementRule?: FieldRule<U, TAll>; // 元素级规则
  };

// ==== 泛型推导：字段类型 → 规则类型 ====
export type FieldRule<TValue, TAll> = TValue extends string
  ? StringRule<TAll>
  : TValue extends number
    ? NumberRule<TAll>
    : TValue extends boolean
      ? BooleanRule<TAll>
      : TValue extends (infer U)[]
        ? ArrayRule<TAll, U>
        : BaseRule<TAll, TValue>;

// ==== 描述对象 ====
export type RuleDescription<T extends Record<string, unknown>> = {
  [K in keyof T]?: FieldRule<T[K], T> | FieldRule<T[K], T>[];
};

// ==== Required 判断 ====
type IsRequired<R> = R extends { required: true } ? true : false;

export type ApplyRules<
  T extends Record<string, unknown>,
  R extends RuleDescription<T>,
> = {
  [K in keyof T]: IsRequired<R[K]> extends true ? T[K] : T[K] | undefined;
};

// ==== 错误收集 ====
type FieldErrors<T> = Partial<Record<keyof T, string[]>>;

function pushError<T extends Record<string, unknown>>(
  fieldErrors: FieldErrors<T>,
  field: keyof T,
  msg: string
) {
  if (!msg) return;
  if (!fieldErrors[field]) fieldErrors[field] = [];
  (fieldErrors[field] as string[]).push(msg);
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function isValueProvided(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function defaultMsg(field: string | number | symbol, reason: string) {
  return `${String(field)} ${reason}`;
}

// ==== 内置校验器 ====
const builtins = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^(https?:\/\/)?([\w.-]+)\.([a-z]{2,6})([/\w .-]*)*\/?$/,
  phone: /^1[3-9]\d{9}$/, // 中国手机号
};

// ==== 单字段校验 ====
function validateRule<T extends Record<string, unknown>, V>(
  key: keyof T,
  value: V,
  rule: FieldRule<V, T>,
  data: Partial<T>,
  fieldErrors: FieldErrors<T>
) {
  const present = isPresent(value);
  const valueProvided = isValueProvided(value);

  // required
  if (rule.required && !present) {
    pushError(fieldErrors, key, rule.message ?? defaultMsg(key, '为必填项'));
    return;
  }
  // 如果值没有提供且不是必填，跳过验证
  if (!valueProvided && !rule.required) return;

  // dependsOn
  if (rule.dependsOn) {
    const res = rule.dependsOn(data);
    if (res === false)
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, '依赖条件未满足')
      );
    else if (typeof res === 'string') pushError(fieldErrors, key, res);
  }

  // string 相关校验
  if (typeof value === 'string') {
    const stringRule = rule as StringRule<T>;
    const { len, min, max, regex, email, url, phone } = stringRule;

    if (typeof len === 'number' && value.length !== len) {
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, `长度必须为 ${len}`)
      );
    }
    if (typeof min === 'number' && value.length < min) {
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, `长度不能少于 ${min}`)
      );
    }
    if (typeof max === 'number' && value.length > max) {
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, `长度不能超过 ${max}`)
      );
    }
    if (regex && !regex.test(value)) {
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, '格式不正确')
      );
    }
    if (email && !builtins.email.test(value)) {
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, '不是有效的邮箱')
      );
    }
    if (url && !builtins.url.test(value)) {
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, '不是有效的URL')
      );
    }
    if (phone && !builtins.phone.test(value)) {
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, '不是有效的手机号')
      );
    }
  }

  // number 相关校验
  if (typeof value === 'number') {
    const numberRule = rule as NumberRule<T>;
    const { min, max } = numberRule;
    if (typeof min === 'number' && value < min) {
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, `不能小于 ${min}`)
      );
    }
    if (typeof max === 'number' && value > max) {
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, `不能大于 ${max}`)
      );
    }
  }

  // array 相关校验
  if (Array.isArray(value)) {
    const arrayRule = rule as ArrayRule<T, unknown>;
    const { len, min, max, unique, elementRule } = arrayRule;

    if (typeof len === 'number' && value.length !== len) {
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, `长度必须为 ${len}`)
      );
    }
    if (typeof min === 'number' && value.length < min) {
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, `长度不能小于 ${min}`)
      );
    }
    if (typeof max === 'number' && value.length > max) {
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, `长度不能大于 ${max}`)
      );
    }
    if (unique && new Set(value).size !== value.length) {
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, '元素必须唯一')
      );
    }
    if (elementRule) {
      (value as unknown[]).forEach((v, i) => {
        validateRule(
          `${String(key)}[${i}]` as keyof T,
          v as unknown,
          elementRule as FieldRule<unknown, T>,
          data,
          fieldErrors
        );
      });
    }
  }

  // 自定义 validator
  if (rule.validator) {
    const res = (
      rule.validator as
        | ((value: unknown, data: Partial<T>) => boolean | string)
        | undefined
    )?.(value as unknown, data);
    if (res === false)
      pushError(
        fieldErrors,
        key,
        rule.message ?? defaultMsg(key, '校验未通过')
      );
    else if (typeof res === 'string') pushError(fieldErrors, key, res);
  }
}

// ==== 主函数 ====
export function ruleChecker<
  T extends Record<string, unknown>,
  R extends RuleDescription<T>,
>(
  data: Partial<T>,
  rules: R
):
  | { valid: true; data: ApplyRules<T, R> }
  | { valid: false; errors: string[]; fieldErrors: FieldErrors<T> } {
  const fieldErrors: FieldErrors<T> = {};

  for (const k in rules) {
    const key = k as keyof T;
    const ruleOrRules = rules[key] as
      | FieldRule<T[typeof key] | undefined, T>
      | FieldRule<T[typeof key] | undefined, T>[]
      | undefined;
    if (!ruleOrRules) continue;

    const value = data[key] as T[typeof key] | undefined;

    // 支持单个规则或规则数组
    if (Array.isArray(ruleOrRules)) {
      // 处理规则数组
      for (const rule of ruleOrRules) {
        validateRule<T, T[typeof key] | undefined>(
          key,
          value,
          rule,
          data,
          fieldErrors
        );
      }
    } else {
      // 处理单个规则
      validateRule<T, T[typeof key] | undefined>(
        key,
        value,
        ruleOrRules,
        data,
        fieldErrors
      );
    }
  }

  // 聚合错误时，避免 [] 被推断为 never[] 导致的类型问题
  const errors: string[] = (
    Object.values(fieldErrors) as Array<string[] | undefined>
  ).reduce<string[]>((acc, v) => {
    if (v) acc.push(...v);
    return acc;
  }, []);

  if (errors.length > 0) {
    return { valid: false, errors, fieldErrors };
  }

  return { valid: true, data: data as ApplyRules<T, R> };
}
