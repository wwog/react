import {describe, expect, it} from 'vitest'
import {Counter, formatDate} from './sundry'

describe('formatDate', () => {
  // 使用一个固定的日期来测试，以避免时间差异导致的测试失败
  // 2023-04-15 14:30:45.678 星期六
  const testDate = new Date(2023, 3, 15, 14, 30, 45, 678)

  it('应该正确格式化年份', () => {
    expect(formatDate('YY', testDate)).toBe('23')
    expect(formatDate('YYYY', testDate)).toBe('2023')
  })

  it('应该正确格式化月份', () => {
    expect(formatDate('M', testDate)).toBe('4')
    expect(formatDate('MM', testDate)).toBe('04')
    expect(formatDate('MMM', testDate)).toBe('Apr')
    expect(formatDate('MMMM', testDate)).toBe('April')
  })

  it('应该正确格式化日期', () => {
    expect(formatDate('D', testDate)).toBe('15')
    expect(formatDate('DD', testDate)).toBe('15')
  })

  it('应该正确格式化星期', () => {
    expect(formatDate('d', testDate)).toBe('6')
    expect(formatDate('dd', testDate)).toBe('Sat')
    expect(formatDate('ddd', testDate)).toBe('Sat')
    expect(formatDate('dddd', testDate)).toBe('Saturday')
  })

  it('应该正确格式化小时', () => {
    expect(formatDate('H', testDate)).toBe('14')
    expect(formatDate('HH', testDate)).toBe('14')
    expect(formatDate('h', testDate)).toBe('2')
    expect(formatDate('hh', testDate)).toBe('02')
  })

  it('应该正确格式化分钟和秒', () => {
    expect(formatDate('m', testDate)).toBe('30')
    expect(formatDate('mm', testDate)).toBe('30')
    expect(formatDate('s', testDate)).toBe('45')
    expect(formatDate('ss', testDate)).toBe('45')
  })

  it('应该正确格式化毫秒', () => {
    expect(formatDate('SSS', testDate)).toBe('678')
  })

  it('应该正确格式化上午/下午', () => {
    expect(formatDate('A', testDate)).toBe('PM')
    expect(formatDate('a', testDate)).toBe('pm')

    const morningDate = new Date(2023, 3, 15, 9, 30, 45, 678)
    expect(formatDate('A', morningDate)).toBe('AM')
    expect(formatDate('a', morningDate)).toBe('am')
  })

  it('应该正确组合多种格式', () => {
    expect(formatDate('YYYY-MM-DD', testDate)).toBe('2023-04-15')
    expect(formatDate('YYYY/MM/DD HH:mm:ss', testDate)).toBe('2023/04/15 14:30:45')
    expect(formatDate('YYYY年MM月DD日 HH时mm分ss秒', testDate)).toBe('2023年04月15日 14时30分45秒')
    expect(formatDate('YY-MM-DD hh:mm:ss A', testDate)).toBe('23-04-15 02:30:45 PM')
  })

  it('当不传入日期时应该使用当前日期', () => {
    // 由于测试时间不确定，这里只测试格式是否正确，不测试具体的值
    const result = formatDate('YYYY-MM-DD')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('Counter', () => {
  it('应该从0开始计数', () => {
    const counter = new Counter()
    expect(counter.count).toBe(0)
  })

  it('next() 方法应该返回当前计数并递增', () => {
    const counter = new Counter()
    expect(counter.next()).toBe(0)
    expect(counter.count).toBe(1)
    expect(counter.next()).toBe(1)
    expect(counter.count).toBe(2)
  })

  it('连续调用 next() 应该正确递增', () => {
    const counter = new Counter()
    expect(counter.next()).toBe(0)
    expect(counter.next()).toBe(1)
    expect(counter.next()).toBe(2)
    expect(counter.next()).toBe(3)
    expect(counter.count).toBe(4)
  })
})

/* describe("cx", () => {
  it("应该正确合并字符串类名", () => {
    expect(cx("foo", "bar")).toBe("foo bar");
    expect(cx("foo", "bar", "baz")).toBe("foo bar baz");
  });

  it("应该过滤掉 falsy 值", () => {
    expect(cx("foo", null, "bar", undefined, false)).toBe("foo bar");
  });

  it("应该正确处理数组", () => {
    expect(cx(["foo", "bar"])).toBe("foo bar");
    expect(cx("baz", ["foo", "bar"])).toBe("baz foo bar");
  });

  it("应该正确处理对象", () => {
    expect(cx({ foo: true, bar: false })).toBe("foo");
    expect(cx({ foo: true, bar: true })).toBe("foo bar");
  });

  it("应该正确处理混合输入", () => {
    expect(cx("foo", ["bar", "baz"], { qux: true, quux: false })).toBe(
      "foo bar baz qux"
    );
  });

  it("应该去除重复的类名", () => {
    expect(cx("foo", "foo", "bar")).toBe("foo bar");
    expect(cx("foo", ["foo", "bar"])).toBe("foo bar");
    expect(cx("foo", { foo: true })).toBe("foo");
  });
});
 */
