import { describe, expect, it } from 'vitest';
import { ruleChecker } from './ruleChecker';
import type { RuleDescription } from './ruleChecker';

describe('ruleChecker', () => {
  // ==== 基础功能测试 ====
  describe('基础功能', () => {
    it('应该通过空规则验证', () => {
      const result = ruleChecker({}, {});
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual({});
      }
    });

    it('应该验证 required 规则 - 成功', () => {
      const data = { name: 'John' };
      const rules: RuleDescription<typeof data> = {
        name: { required: true },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.name).toBe('John');
      }
    });

    it('应该验证 required 规则 - 失败', () => {
      const data = { name: '' };
      const rules: RuleDescription<typeof data> = {
        name: { required: true },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('name 为必填项');
        expect(result.fieldErrors.name).toContain('name 为必填项');
      }
    });

    it('应该使用自定义错误消息', () => {
      const data = { email: '' };
      const rules: RuleDescription<typeof data> = {
        email: { required: true, message: '邮箱不能为空' },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('邮箱不能为空');
      }
    });

    it('应该处理 null 和 undefined 值', () => {
      type DataType = { name: string | null; age?: number };
      const data: Partial<DataType> = { name: null, age: undefined };
      const rules: RuleDescription<DataType> = {
        name: { required: true },
        age: { required: false },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.fieldErrors.name).toContain('name 为必填项');
        expect(result.fieldErrors.age).toBeUndefined();
      }
    });

    it('应该验证自定义 validator - 返回 boolean', () => {
      const data = { password: '123' };
      const rules: RuleDescription<typeof data> = {
        password: {
          validator: (value) => value.length >= 6,
          message: '密码至少6位',
        },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('密码至少6位');
      }
    });

    it('应该验证自定义 validator - 返回 string', () => {
      const data = { username: 'admin' };
      const rules: RuleDescription<typeof data> = {
        username: {
          validator: (value) =>
            value === 'admin' ? '用户名不能是admin' : true,
        },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('用户名不能是admin');
      }
    });
  });

  // ==== 字符串规则测试 ====
  describe('字符串规则', () => {
    it('应该验证字符串长度 len', () => {
      const data = { code: '123' };
      const rules: RuleDescription<typeof data> = {
        code: { len: 4 },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('code 长度必须为 4');
      }
    });

    it('应该验证字符串最小长度 min', () => {
      const data = { username: 'ab' };
      const rules: RuleDescription<typeof data> = {
        username: { min: 3 },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('username 长度不能少于 3');
      }
    });

    it('应该验证字符串最大长度 max', () => {
      const data = { comment: 'a'.repeat(101) };
      const rules: RuleDescription<typeof data> = {
        comment: { max: 100 },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('comment 长度不能超过 100');
      }
    });

    it('应该验证正则表达式', () => {
      const data = { phone: '123456' };
      const rules: RuleDescription<typeof data> = {
        phone: { regex: /^\d{11}$/ },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('phone 格式不正确');
      }
    });

    it('应该验证邮箱格式', () => {
      const data = { email: 'invalid-email' };
      const rules: RuleDescription<typeof data> = {
        email: { email: true },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('email 不是有效的邮箱');
      }
    });

    it('应该通过有效的邮箱验证', () => {
      const data = { email: 'test@example.com' };
      const rules: RuleDescription<typeof data> = {
        email: { email: true },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(true);
    });

    it('应该验证URL格式', () => {
      const data = { website: 'invalid-url' };
      const rules: RuleDescription<typeof data> = {
        website: { url: true },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('website 不是有效的URL');
      }
    });

    it('应该通过有效的URL验证', () => {
      const data = { website: 'https://example.com' };
      const rules: RuleDescription<typeof data> = {
        website: { url: true },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(true);
    });

    it('应该验证手机号格式', () => {
      const data = { mobile: '123456789' };
      const rules: RuleDescription<typeof data> = {
        mobile: { phone: true },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('mobile 不是有效的手机号');
      }
    });

    it('应该通过有效的手机号验证', () => {
      const data = { mobile: '13812345678' };
      const rules: RuleDescription<typeof data> = {
        mobile: { phone: true },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(true);
    });
  });

  // ==== 数字规则测试 ====
  describe('数字规则', () => {
    it('应该验证数字最小值', () => {
      const data = { age: 5 };
      const rules: RuleDescription<typeof data> = {
        age: { min: 18 },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('age 不能小于 18');
      }
    });

    it('应该验证数字最大值', () => {
      const data = { score: 105 };
      const rules: RuleDescription<typeof data> = {
        score: { max: 100 },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('score 不能大于 100');
      }
    });

    it('应该通过数字范围验证', () => {
      const data = { percentage: 85 };
      const rules: RuleDescription<typeof data> = {
        percentage: { min: 0, max: 100 },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(true);
    });
  });

  // ==== 数组规则测试 ====
  describe('数组规则', () => {
    it('应该验证数组长度 len', () => {
      const data = { items: [1, 2, 3] };
      const rules: RuleDescription<typeof data> = {
        items: { len: 5 },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('items 长度必须为 5');
      }
    });

    it('应该验证数组最小长度', () => {
      const data = { tags: ['one'] };
      const rules: RuleDescription<typeof data> = {
        tags: { min: 2 },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('tags 长度不能小于 2');
      }
    });

    it('应该验证数组最大长度', () => {
      const data = { categories: [1, 2, 3, 4, 5, 6] };
      const rules: RuleDescription<typeof data> = {
        categories: { max: 5 },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('categories 长度不能大于 5');
      }
    });

    it('应该验证数组元素唯一性', () => {
      const data = { ids: [1, 2, 2, 3] };
      const rules: RuleDescription<typeof data> = {
        ids: { unique: true },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('ids 元素必须唯一');
      }
    });

    it('应该通过数组元素唯一性验证', () => {
      const data = { ids: [1, 2, 3, 4] };
      const rules: RuleDescription<typeof data> = {
        ids: { unique: true },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(true);
    });

    it('应该验证数组元素规则', () => {
      const data = { emails: ['valid@email.com', 'invalid-email'] };
      const rules: RuleDescription<typeof data> = {
        emails: {
          elementRule: { email: true },
        },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        // 检查错误信息包含了数组元素索引的错误
        expect(result.errors.some((error) => error.includes('emails[1]'))).toBe(
          true
        );
      }
    });
  });

  // ==== 依赖验证测试 ====
  describe('依赖验证', () => {
    it('应该验证 dependsOn - 返回 boolean', () => {
      const data = { type: 'premium', discount: 0.9 };
      const rules: RuleDescription<typeof data> = {
        discount: {
          dependsOn: (data) => data.type === 'basic', // 当类型不是basic时会失败
          message: '只有基础用户才能设置折扣',
        },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('只有基础用户才能设置折扣');
      }
    });

    it('应该验证 dependsOn - 返回 string', () => {
      const data = { age: 16, hasLicense: true };
      const rules: RuleDescription<typeof data> = {
        hasLicense: {
          dependsOn: (data) =>
            (data.age || 0) < 18 ? '未成年人不能有驾驶证' : true,
        },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('未成年人不能有驾驶证');
      }
    });

    it('应该通过 dependsOn 验证', () => {
      const data = { type: 'basic', discount: undefined };
      const rules: RuleDescription<typeof data> = {
        discount: {
          dependsOn: (data) => data.type === 'premium',
        },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(true);
    });
  });

  // ==== 复杂场景测试 ====
  describe('复杂场景', () => {
    it('应该处理多个规则数组', () => {
      const data = { password: '123' };
      const rules: RuleDescription<typeof data> = {
        password: [
          { required: true },
          { min: 6, message: '密码至少6位' },
          { regex: /[A-Z]/, message: '密码必须包含大写字母' },
        ],
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('密码至少6位');
        expect(result.errors).toContain('密码必须包含大写字母');
      }
    });

    it('应该收集多个字段的错误', () => {
      const data = { name: '', email: 'invalid', age: 5 };
      const rules: RuleDescription<typeof data> = {
        name: { required: true },
        email: { email: true },
        age: { min: 18 },
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toHaveLength(3);
        expect(result.fieldErrors.name).toContain('name 为必填项');
        expect(result.fieldErrors.email).toContain('email 不是有效的邮箱');
        expect(result.fieldErrors.age).toContain('age 不能小于 18');
      }
    });

    it('应该处理复杂的用户注册场景', () => {
      const data = {
        username: 'ab',
        email: 'test@example.com',
        password: '123',
        confirmPassword: '456',
        age: 25,
        hobbies: ['reading'],
        terms: false,
      };

      const rules: RuleDescription<typeof data> = {
        username: { required: true, min: 3, max: 20 },
        email: { required: true, email: true },
        password: [
          { required: true },
          { min: 6 },
          { regex: /[A-Z]/, message: '密码必须包含大写字母' },
        ],
        confirmPassword: {
          required: true,
          validator: (value, data) =>
            value === data.password || '两次密码不一致',
        },
        age: { required: true, min: 18, max: 120 },
        hobbies: { min: 2, max: 5 },
        terms: {
          required: true,
          validator: (value) => value === true || '必须同意用户协议',
        },
      };

      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.fieldErrors.username).toContain(
          'username 长度不能少于 3'
        );
        expect(result.fieldErrors.password).toContain(
          'password 长度不能少于 6'
        );
        expect(result.fieldErrors.confirmPassword).toContain('两次密码不一致');
        expect(result.fieldErrors.hobbies).toContain('hobbies 长度不能小于 2');
        expect(result.fieldErrors.terms).toContain('必须同意用户协议');
      }
    });

    it('应该在所有验证通过时返回正确的数据', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };

      const rules: RuleDescription<typeof data> = {
        name: { required: true, min: 2 },
        email: { required: true, email: true },
        age: { required: true, min: 18, max: 120 },
      };

      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual(data);
      }
    });
  });

  // ==== 类型安全测试 ====
  describe('类型安全验证', () => {
    it('数字字段应该只支持数字相关规则', () => {
      const data = { age: 25 };

      // 这些应该是有效的数字规则
      const validRules: RuleDescription<typeof data> = {
        age: { min: 0, max: 120, required: true },
      };

      const result = ruleChecker(data, validRules);
      expect(result.valid).toBe(true);

      // 注意：TypeScript 会阻止以下无效的数字规则
      // age: { email: true }, // ❌ 编译错误
      // age: { regex: /test/ }, // ❌ 编译错误
      // age: { len: 10 }, // ❌ 编译错误
    });

    it('字符串字段应该支持长度和格式规则', () => {
      const data = { email: 'test@example.com', name: 'John' };

      const rules: RuleDescription<typeof data> = {
        email: {
          required: true,
          email: true,
          min: 5,
          max: 100,
        },
        name: {
          required: true,
          min: 2,
          max: 50,
          regex: /^[a-zA-Z]+$/,
        },
      };

      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(true);
    });

    it('数组字段应该支持长度和唯一性规则', () => {
      const data = { tags: ['react', 'typescript'], ids: [1, 2, 3] };

      const rules: RuleDescription<typeof data> = {
        tags: {
          min: 1,
          max: 5,
          unique: true,
          elementRule: { min: 2, max: 20 }, // 元素是字符串
        },
        ids: {
          len: 3,
          unique: true,
          elementRule: { min: 1, max: 1000 }, // 元素是数字
        },
      };

      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(true);
    });

    it('布尔字段应该只支持基础规则', () => {
      const data = { isActive: false, hasPermission: false };

      const rules: RuleDescription<typeof data> = {
        isActive: {
          required: true,
          validator: (value) => value === true || '必须激活账户',
        },
        hasPermission: {
          required: true,
        },
      };

      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('必须激活账户');
      }
    });

    it('应该正确处理混合类型的复杂对象', () => {
      const data = {
        id: 123,
        name: 'Product Name',
        price: 99.99,
        tags: ['electronics', 'mobile'],
        isActive: true,
        description: 'A great product',
      };

      const rules: RuleDescription<typeof data> = {
        id: { required: true, min: 1 }, // 数字规则
        name: { required: true, min: 3, max: 50 }, // 字符串长度规则
        price: { required: true, min: 0, max: 10000 }, // 数字范围规则
        tags: { min: 1, max: 10, unique: true }, // 数组规则
        isActive: { required: true }, // 布尔基础规则
        description: { min: 10, max: 500, regex: /^[a-zA-Z\s]+$/ }, // 字符串格式规则
      };

      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(true);
    });
  });

  // ==== 边缘情况测试 ====
  describe('边缘情况', () => {
    it('应该正确处理空字符串的各种验证', () => {
      const data = { text: '' };
      const rules: RuleDescription<typeof data> = {
        text: { min: 1 }, // 空字符串长度为0，应该失败
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
    });

    it('应该正确处理空数组的各种验证', () => {
      const data = { items: [] as string[] };
      const rules: RuleDescription<typeof data> = {
        items: { min: 1 }, // 空数组长度为0，应该失败
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
    });

    it('应该正确处理数字 0 的验证', () => {
      const data = { count: 0 };
      const rules: RuleDescription<typeof data> = {
        count: { required: true, min: 0 }, // 0 是有效值，应该通过
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(true);
    });

    it('应该正确处理 false 值的验证', () => {
      const data = { isEnabled: false };
      const rules: RuleDescription<typeof data> = {
        isEnabled: { required: true }, // false 是有效值，应该通过
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(true);
    });

    it('应该正确处理只有空格的字符串', () => {
      const data = { text: '   ' };
      const rules: RuleDescription<typeof data> = {
        text: { required: true }, // 只有空格被视为空值，应该失败
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
    });

    it('应该处理非常长的字符串', () => {
      const longText = 'a'.repeat(1000);
      const data = { content: longText };
      const rules: RuleDescription<typeof data> = {
        content: { max: 500 }, // 超过最大长度，应该失败
      };
      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('content 长度不能超过 500');
      }
    });

    it('应该处理复杂的嵌套数组元素验证', () => {
      const data = {
        users: [
          { name: 'Alice', email: 'alice@test.com' },
          { name: 'B', email: 'invalid-email' }, // 名字太短，邮箱无效
        ],
      };

      // 注意：这个例子展示了当前系统的限制
      // 对于复杂嵌套对象，需要扩展 elementRule 支持
      const rules: RuleDescription<typeof data> = {
        users: {
          min: 1,
          max: 10,
          // elementRule 目前不支持对象验证
        },
      };

      const result = ruleChecker(data, rules);
      expect(result.valid).toBe(true); // 基本数组规则通过
    });
  });
});
